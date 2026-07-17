import type { Express } from "express";
import { createServer, type Server } from "http";
import * as Sentry from "@sentry/node";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { insertDocumentSchema, insertConversationSchema, insertMessageSchema, insertSettingsSchema } from "@shared/schema";
import { extractTextFromFile, chunkText, validateFileUpload } from "./services/document-processor";
import { generateEmbeddings, generateChatResponse, findRelevantChunks } from "./services/openai";
import { getKnowledgeBaseId } from "./services/knowledge-base";

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }
});

function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

const MAX_ADMIN_ATTEMPTS = 10;
const ADMIN_LOCKOUT_MS = 15 * 60 * 1000;
const failedAdminAttempts = new Map<string, { count: number; lockedUntil: number }>();

function requireAdminAuth(req: any, res: any, next: any) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(503).json({ error: "ADMIN_PASSWORD not configured" });
  }

  const ip = req.ip;
  const attempt = failedAdminAttempts.get(ip);
  if (attempt && attempt.lockedUntil > Date.now()) {
    return res.status(429).json({ error: "Too many failed login attempts. Try again later." });
  }

  const auth = req.headers.authorization;
  if (!auth || typeof auth !== "string" || !timingSafeStringEqual(auth, `Bearer ${adminPassword}`)) {
    const count = (attempt?.count ?? 0) + 1;
    failedAdminAttempts.set(ip, {
      count,
      lockedUntil: count >= MAX_ADMIN_ATTEMPTS ? Date.now() + ADMIN_LOCKOUT_MS : 0,
    });
    return res.status(401).json({ error: "Unauthorized" });
  }

  failedAdminAttempts.delete(ip);
  next();
}

// Backstop limit for all /api/* routes
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Strict limit for the OpenAI chat endpoint
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages sent, please slow down and try again in a minute." },
});

// Strict limit for document upload endpoints (trigger embedding generation)
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads, please try again in a minute." },
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.use("/api", generalLimiter);


  // Serve widget script
  app.get("/widget.js", async (req, res) => {
    try {
      const widgetScript = path.resolve(__dirname, "..", "public", "widget.js");
      const script = await fs.readFile(widgetScript, "utf-8");
      res.status(200).set({ "Content-Type": "application/javascript" }).end(script);
    } catch (error: any) {
      console.error('Error serving widget script:', error);
      res.status(500).send('// Error loading widget script');
    }
  });

  // Serve embed page - simple HTML without Vite processing
  app.get("/embed", (req, res) => {
    const embedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Chat Widget</title>
    <style>
        body { 
            margin: 0; 
            padding: 0; 
            overflow: hidden; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: transparent;
        }
        #widget-container { 
            width: 100vw; 
            height: 100vh; 
            background: transparent;
        }
    </style>
</head>
<body>
    <div id="widget-container">
        <iframe 
            src="/widget" 
            width="100%" 
            height="100%" 
            style="border: none; background: transparent;"
            title="AI Chat Interface">
        </iframe>
    </div>
    <script>
        // Widget ready notification
        if (window.parent !== window) {
            window.parent.postMessage({ 
                type: 'WIDGET_READY', 
                source: 'ai-widget' 
            }, '*');
        }
    </script>
</body>
</html>`;
    
    res.status(200).set({ "Content-Type": "text/html" }).end(embedHtml);
  });
  
  // Public widget config endpoint (company name + greeting for the chat widget)
  app.get("/api/widget/config", async (req, res) => {
    try {
      const s = await storage.getSettings();
      res.json({
        companyName: s?.companyName || "AI Assistant",
        widgetGreeting: s?.widgetGreeting || "Hi! I'm your AI assistant. How can I help you today?",
        primaryColor: s?.primaryColor || "#2194f3",
      });
    } catch (error: any) {
      Sentry.captureException(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: analytics (CORS enabled, scoped to the known dashboard origins, so the
  // standalone dashboard can call this directly from a different Railway domain)
  const ALLOWED_DASHBOARD_ORIGINS = new Set([
    "https://documentorai-dashboard-production.up.railway.app",
    "http://localhost:5173",
    "http://localhost:3000",
  ]);

  function applyDashboardCors(req: any, res: any) {
    const origin = req.headers.origin;
    if (origin && ALLOWED_DASHBOARD_ORIGINS.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
    }
  }

  app.options("/api/admin/analytics", (req, res) => {
    applyDashboardCors(req, res);
    res.header("Access-Control-Allow-Methods", "GET");
    res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.sendStatus(200);
  });

  app.get("/api/admin/analytics", requireAdminAuth, async (req, res) => {
    applyDashboardCors(req, res);
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (error: any) {
      Sentry.captureException(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: get settings
  app.get("/api/admin/settings", requireAdminAuth, async (req, res) => {
    try {
      const s = await storage.getSettings();
      res.json(s || {
        companyName: "",
        companyDescription: "",
        systemPrompt: "",
        widgetGreeting: "Hi! I'm your AI assistant. How can I help you today?",
      });
    } catch (error: any) {
      Sentry.captureException(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: save settings
  app.post("/api/admin/settings", requireAdminAuth, async (req, res) => {
    try {
      const data = insertSettingsSchema.parse(req.body);
      const saved = await storage.upsertSettings(data);
      res.json(saved);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Admin: upload knowledge base file
  app.post("/api/admin/knowledge-base", uploadLimiter, requireAdminAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const validation = validateFileUpload(req.file);
      if (!validation.valid) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: validation.error });
      }
      const textContent = await extractTextFromFile(req.file.path, req.file.mimetype);
      const chunks = chunkText(textContent);
      const embeddings = await generateEmbeddings(chunks);
      const document = await storage.createDocument({
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        content: textContent,
        chunks,
        embeddings,
      });
      await fs.unlink(req.file.path).catch(() => {});
      // Update the knowledge base pointer
      const { setKnowledgeBaseId } = await import("./services/knowledge-base");
      setKnowledgeBaseId(document.id);
      res.json({
        id: document.id,
        originalName: document.originalName,
        chunks: chunks.length,
        message: "Knowledge base updated successfully",
      });
    } catch (error: any) {
      Sentry.captureException(error);
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      res.status(500).json({ error: error.message });
    }
  });

  // Upload and process document (unused by the current widget/admin UI; auth-gated since it triggers billed OpenAI calls)
  app.post("/api/documents", uploadLimiter, requireAdminAuth, upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const validation = validateFileUpload(req.file);
      if (!validation.valid) {
        // Clean up uploaded file
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: validation.error });
      }

      // Extract text content
      const textContent = await extractTextFromFile(req.file.path, req.file.mimetype);
      
      // Chunk the text
      const chunks = chunkText(textContent);
      
      // Generate embeddings for chunks
      const embeddings = await generateEmbeddings(chunks);

      // Create document record
      const documentData = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        content: textContent,
      };

      const document = await storage.createDocument({
        ...documentData,
        chunks,
        embeddings
      });

      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(() => {});

      res.json({
        id: document.id,
        originalName: document.originalName,
        size: document.size,
        chunks: chunks.length,
        message: "Document processed successfully"
      });

    } catch (error) {
      Sentry.captureException(error);
      // Clean up uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get document info
  app.get("/api/documents/:id", requireAdminAuth, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json({
        id: document.id,
        originalName: document.originalName,
        size: document.size,
        chunks: document.chunks.length,
        createdAt: document.createdAt
      });

    } catch (error: any) {
      Sentry.captureException(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create or get conversation
  app.post("/api/conversations", async (req, res) => {
    try {
      const validatedData = insertConversationSchema.parse(req.body);
      
      // Check if conversation already exists for this session
      const existingConversation = await storage.getConversationBySession(validatedData.sessionId);
      
      if (existingConversation) {
        return res.json(existingConversation);
      }

      const conversation = await storage.createConversation(validatedData);
      res.json(conversation);

    } catch (error: any) {
      Sentry.captureException(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send message and get AI response
  app.post("/api/conversations/:id/messages", messageLimiter, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content, sessionId } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Message content is required" });
      }
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: "Session ID is required" });
      }

      // Get conversation and document
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      if (conversation.sessionId !== sessionId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Save user message
      const userMessage = await storage.createMessage({
        conversationId,
        role: "user",
        content,
        sourceChunks: []
      });

      // Get conversation history
      const messages = await storage.getConversationMessages(conversationId);
      const conversationHistory = messages.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      let relevantChunks: string[] = [];
      let aiResponse: string;

      // Always use knowledge base for context
      const knowledgeBaseId = getKnowledgeBaseId();
      if (knowledgeBaseId) {
        const knowledgeBase = await storage.getDocument(knowledgeBaseId);
        if (knowledgeBase) {
          relevantChunks = await findRelevantChunks(
            content,
            knowledgeBase.chunks,
            knowledgeBase.embeddings,
            3 // Use more chunks for better context
          );
        }
      }

      // Also check if there's a user-specific document
      if (conversation.documentId) {
        const document = await storage.getDocument(conversation.documentId);
        if (document) {
          const docChunks = await findRelevantChunks(
            content,
            document.chunks,
            document.embeddings
          );
          relevantChunks = [...relevantChunks, ...docChunks];
        }
      }

      // Load company settings for system prompt
      const companySettings = await storage.getSettings();

      // Generate AI response
      const { response, sourceChunks } = await generateChatResponse(
        content,
        relevantChunks,
        conversationHistory,
        companySettings ? {
          companyName: companySettings.companyName,
          companyDescription: companySettings.companyDescription,
          systemPrompt: companySettings.systemPrompt,
        } : undefined
      );

      aiResponse = response;

      // Save AI message
      const aiMessage = await storage.createMessage({
        conversationId,
        role: "assistant",
        content: aiResponse,
        sourceChunks
      });

      res.json({
        userMessage,
        aiMessage
      });

    } catch (error: any) {
      Sentry.captureException(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get conversation messages
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const sessionId = req.query.sessionId;

      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: "Session ID is required" });
      }

      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      if (conversation.sessionId !== sessionId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const messages = await storage.getConversationMessages(conversationId);
      res.json(messages);

    } catch (error: any) {
      Sentry.captureException(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", requireAdminAuth, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      await storage.deleteDocument(documentId);
      res.json({ message: "Document deleted successfully" });

    } catch (error: any) {
      Sentry.captureException(error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
