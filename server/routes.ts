import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import * as Sentry from "@sentry/node";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { insertSettingsSchema, type Message } from "@shared/schema";
import { extractTextFromFile, chunkText, validateFileUpload } from "./services/document-processor";
import { generateEmbeddings, generateChatResponse, findRelevantChunks } from "./services/openai";
import { getKnowledgeBase, setKnowledgeBase } from "./services/knowledge-base";

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Abuse limits for the public chat endpoints
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_MESSAGE_CHARS = 2000;
const MAX_MESSAGES_PER_CONVERSATION = 100;
const MAX_KB_CHUNKS = 1000;

// Daily OpenAI spend ceiling for this deployment, in USD
const DAILY_OPENAI_BUDGET_USD = (() => {
  const v = parseFloat(process.env.DAILY_OPENAI_BUDGET_USD ?? "");
  return Number.isFinite(v) && v >= 0 ? v : 1;
})();
const BUDGET_CHECK_INTERVAL_MS = 60 * 1000;
const BUDGET_EXCEEDED_REPLY =
  "Sorry, our assistant is temporarily unavailable. Please try again later or contact us directly.";

let budgetCache: { checkedAt: number; spentToday: number } | null = null;
let budgetAlertSentFor: string | null = null;

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function isOverDailyBudget(): Promise<boolean> {
  if (!budgetCache || Date.now() - budgetCache.checkedAt > BUDGET_CHECK_INTERVAL_MS) {
    budgetCache = { checkedAt: Date.now(), spentToday: await storage.openaiCostSince(startOfToday()) };
  }
  const over = budgetCache.spentToday >= DAILY_OPENAI_BUDGET_USD;
  const today = startOfToday().toDateString();
  if (over && budgetAlertSentFor !== today) {
    budgetAlertSentFor = today;
    Sentry.captureMessage(
      `Daily OpenAI budget of $${DAILY_OPENAI_BUDGET_USD} reached ($${budgetCache.spentToday.toFixed(4)} spent); chat replies paused until tomorrow`,
      "warning",
    );
    console.warn(`Daily OpenAI budget reached: $${budgetCache.spentToday.toFixed(4)} / $${DAILY_OPENAI_BUDGET_USD}`);
  }
  return over;
}

// Log the real error, send the client something generic
function sendServerError(res: Response, error: unknown) {
  Sentry.captureException(error);
  console.error(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
}

// Public message shape; internal fields like sourceChunks stay server-side
function publicMessage(m: Message) {
  return { id: m.id, role: m.role, content: m.content, createdAt: m.createdAt };
}

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const conversationBodySchema = z.object({
  sessionId: z.string().min(8).max(100),
});

const messageBodySchema = z.object({
  sessionId: z.string().min(8).max(100),
  content: z.string().trim().min(1, "Message content is required").max(MAX_MESSAGE_CHARS, `Messages are limited to ${MAX_MESSAGE_CHARS} characters`),
});

function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

const MAX_ADMIN_ATTEMPTS = 10;
const ADMIN_LOCKOUT_MS = 15 * 60 * 1000;
const MAX_TRACKED_IPS = 10_000;
const failedAdminAttempts = new Map<string, { count: number; firstAt: number; lockedUntil: number }>();

function requireAdminAuth(req: any, res: any, next: any) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(503).json({ error: "ADMIN_PASSWORD not configured" });
  }

  const ip = req.ip;
  const now = Date.now();
  let attempt = failedAdminAttempts.get(ip);
  if (attempt && attempt.lockedUntil > now) {
    return res.status(429).json({ error: "Too many failed login attempts. Try again later." });
  }
  // Forget old failures once the lockout or the counting window has passed
  if (attempt && (attempt.lockedUntil > 0 || now - attempt.firstAt > ADMIN_LOCKOUT_MS)) {
    failedAdminAttempts.delete(ip);
    attempt = undefined;
  }

  const auth = req.headers.authorization;
  if (!auth || typeof auth !== "string" || !timingSafeStringEqual(auth, `Bearer ${adminPassword}`)) {
    if (failedAdminAttempts.size >= MAX_TRACKED_IPS) failedAdminAttempts.clear();
    const count = (attempt?.count ?? 0) + 1;
    failedAdminAttempts.set(ip, {
      count,
      firstAt: attempt?.firstAt ?? now,
      lockedUntil: count >= MAX_ADMIN_ATTEMPTS ? now + ADMIN_LOCKOUT_MS : 0,
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

// Strict per-IP limit for the OpenAI chat endpoint
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages sent, please slow down and try again in a minute." },
});

// Limit across all IPs, so rotating IPs can't multiply the per-IP limit
const globalMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: () => "global",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "The assistant is very busy right now. Please try again in a minute." },
});

const conversationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
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
  // Liveness check for Railway / uptime monitors; touches nothing billable
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", generalLimiter);


  // Serve widget script
  app.get("/widget.js", async (req, res) => {
    try {
      const widgetScript = path.resolve(__dirname, "..", "public", "widget.js");
      const script = await fs.readFile(widgetScript, "utf-8");
      res.status(200).set({
        "Content-Type": "application/javascript",
        "Cache-Control": "public, max-age=300",
      }).end(script);
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
    } catch (error) {
      sendServerError(res, error);
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
    } catch (error) {
      sendServerError(res, error);
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
    } catch (error) {
      sendServerError(res, error);
    }
  });

  // Admin: save settings
  app.post("/api/admin/settings", requireAdminAuth, async (req, res) => {
    const parsed = insertSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return res.status(400).json({ error: `${issue.path.join(".")}: ${issue.message}` });
    }
    try {
      const saved = await storage.upsertSettings(parsed.data);
      res.json(saved);
    } catch (error) {
      sendServerError(res, error);
    }
  });

  // Admin: current knowledge base info
  app.get("/api/admin/knowledge-base", requireAdminAuth, async (req, res) => {
    try {
      const kb = await getKnowledgeBase();
      res.json(kb ? {
        originalName: kb.originalName,
        size: kb.size,
        chunks: kb.chunks.length,
        createdAt: kb.createdAt,
      } : null);
    } catch (error) {
      sendServerError(res, error);
    }
  });

  // Admin: upload knowledge base file (replaces the previous one)
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
      if (chunks.length === 0) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: "No usable text found in this file." });
      }
      if (chunks.length > MAX_KB_CHUNKS) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          error: `This file is too large for the knowledge base (${chunks.length} sections, limit ${MAX_KB_CHUNKS}, roughly 800 KB of text). Trim it or keep the most important content.`,
        });
      }
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
      setKnowledgeBase(document);
      // Only one knowledge base is active; drop the ones it replaces
      await storage.deleteDocumentsExcept(document.id).catch(err => {
        Sentry.captureException(err);
        console.error("Failed to delete previous knowledge base documents:", err);
      });
      res.json({
        id: document.id,
        originalName: document.originalName,
        size: document.size,
        chunks: chunks.length,
        createdAt: document.createdAt,
        message: "Knowledge base updated successfully",
      });
    } catch (error: any) {
      Sentry.captureException(error);
      console.error(error);
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      // Admin-only route, so the real reason (e.g. a scanned PDF) is useful here
      res.status(500).json({ error: error?.message || "Upload failed" });
    }
  });

  // Create or get conversation
  app.post("/api/conversations", conversationLimiter, async (req, res) => {
    const parsed = conversationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "A valid session ID is required" });
    }
    try {
      const { sessionId } = parsed.data;
      const existingConversation = await storage.getConversationBySession(sessionId);
      if (existingConversation) {
        return res.json({ id: existingConversation.id });
      }

      const conversation = await storage.createConversation({ sessionId });
      res.json({ id: conversation.id });
    } catch (error) {
      sendServerError(res, error);
    }
  });

  // Send message and get AI response
  app.post("/api/conversations/:id/messages", messageLimiter, globalMessageLimiter, async (req, res) => {
    const conversationId = parseId(req.params.id);
    if (!conversationId) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }
    const parsed = messageBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { content, sessionId } = parsed.data;

    try {
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      if (conversation.sessionId !== sessionId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const previousMessages = await storage.getConversationMessages(conversationId);
      if (previousMessages.length >= MAX_MESSAGES_PER_CONVERSATION) {
        return res.status(429).json({
          error: "This conversation has reached its length limit. Starting a new one.",
          code: "conversation_limit",
        });
      }

      const userMessage = await storage.createMessage({
        conversationId,
        role: "user",
        content,
        sourceChunks: []
      });

      if (await isOverDailyBudget()) {
        const aiMessage = await storage.createMessage({
          conversationId,
          role: "assistant",
          content: BUDGET_EXCEEDED_REPLY,
          sourceChunks: []
        });
        return res.json({ userMessage: publicMessage(userMessage), aiMessage: publicMessage(aiMessage) });
      }

      // Prior turns only; the current message is sent separately with its context
      const conversationHistory = previousMessages.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content.slice(0, MAX_HISTORY_MESSAGE_CHARS)
      }));

      let relevantChunks: string[] = [];
      const knowledgeBase = await getKnowledgeBase();
      if (knowledgeBase) {
        relevantChunks = await findRelevantChunks(
          content,
          knowledgeBase.chunks,
          knowledgeBase.embeddings,
          3
        );
      }

      const companySettings = await storage.getSettings();

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

      const aiMessage = await storage.createMessage({
        conversationId,
        role: "assistant",
        content: response,
        sourceChunks
      });

      res.json({
        userMessage: publicMessage(userMessage),
        aiMessage: publicMessage(aiMessage)
      });

    } catch (error) {
      sendServerError(res, error);
    }
  });

  // Get conversation messages
  app.get("/api/conversations/:id/messages", async (req, res) => {
    const conversationId = parseId(req.params.id);
    if (!conversationId) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }
    const sessionId = req.query.sessionId;
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: "Session ID is required" });
    }

    try {
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      if (conversation.sessionId !== sessionId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const messages = await storage.getConversationMessages(conversationId);
      res.json(messages.map(publicMessage));

    } catch (error) {
      sendServerError(res, error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
