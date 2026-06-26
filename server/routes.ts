import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { insertDocumentSchema, insertConversationSchema, insertMessageSchema, insertSettingsSchema } from "@shared/schema";
import { extractTextFromFile, chunkText, validateFileUpload } from "./services/document-processor";
import { generateEmbeddings, generateChatResponse, findRelevantChunks } from "./services/openai";
import { getKnowledgeBaseId } from "./services/knowledge-base";

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }
});

function requireAdminAuth(req: any, res: any, next: any) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(503).json({ error: "ADMIN_PASSWORD not configured" });
  }
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${adminPassword}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  
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
  app.post("/api/admin/knowledge-base", requireAdminAuth, upload.single('file'), async (req, res) => {
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
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      res.status(500).json({ error: error.message });
    }
  });

  // Upload and process document
  app.post("/api/documents", upload.single('document'), async (req, res) => {
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
      // Clean up uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get document info
  app.get("/api/documents/:id", async (req, res) => {
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
      res.status(500).json({ error: error.message });
    }
  });

  // Send message and get AI response
  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Message content is required" });
      }

      // Get conversation and document
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
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
      res.status(500).json({ error: error.message });
    }
  });

  // Get conversation messages
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const messages = await storage.getConversationMessages(conversationId);
      res.json(messages);

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      await storage.deleteDocument(documentId);
      res.json({ message: "Document deleted successfully" });

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
