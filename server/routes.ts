import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import { insertDocumentSchema, insertConversationSchema, insertMessageSchema } from "@shared/schema";
import { extractTextFromFile, chunkText, validateFileUpload } from "./services/document-processor";
import { generateEmbeddings, generateChatResponse, findRelevantChunks } from "./services/openai";

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  
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
      res.status(500).json({ error: error.message });
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

    } catch (error) {
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

    } catch (error) {
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

      if (conversation.documentId) {
        // Get document for context
        const document = await storage.getDocument(conversation.documentId);
        if (document) {
          // Find relevant chunks
          relevantChunks = await findRelevantChunks(
            content,
            document.chunks,
            document.embeddings
          );
        }
      }

      // Generate AI response
      const { response, sourceChunks } = await generateChatResponse(
        content,
        relevantChunks,
        conversationHistory
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

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get conversation messages
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const messages = await storage.getConversationMessages(conversationId);
      res.json(messages);

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      await storage.deleteDocument(documentId);
      res.json({ message: "Document deleted successfully" });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
