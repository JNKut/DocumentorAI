import {
  users, documents, conversations, messages, settings,
  type User, type InsertUser,
  type Document, type InsertDocument,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage,
  type Settings, type InsertSettings
} from "@shared/schema";
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, gte, sql } from 'drizzle-orm';

export interface AnalyticsData {
  totals: {
    conversations: number;
    userMessages: number;
    assistantMessages: number;
    avgMessagesPerConversation: number;
  };
  byPeriod: {
    today:     { conversations: number; messages: number };
    thisWeek:  { conversations: number; messages: number };
    thisMonth: { conversations: number; messages: number };
    allTime:   { conversations: number; messages: number };
  };
  documents: Array<{ originalName: string; size: number; chunkCount: number; createdAt: string }>;
  recentConversations: Array<{ sessionId: string; messageCount: number; createdAt: string }>;
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(document: InsertDocument & { chunks: string[]; embeddings: number[][] }): Promise<Document>;
  deleteDocument(id: number): Promise<void>;
  
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationBySession(sessionId: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  
  getMessage(id: number): Promise<Message | undefined>;
  getConversationMessages(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  getSettings(): Promise<Settings | null>;
  upsertSettings(data: InsertSettings): Promise<Settings>;

  getAnalytics(): Promise<AnalyticsData>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private documents: Map<number, Document>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private currentUserId: number;
  private currentDocumentId: number;
  private currentConversationId: number;
  private currentMessageId: number;
  private settingsStore: Settings | null = null;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.currentUserId = 1;
    this.currentDocumentId = 1;
    this.currentConversationId = 1;
    this.currentMessageId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async createDocument(insertDocument: InsertDocument & { chunks: string[]; embeddings: number[][] }): Promise<Document> {
    const id = this.currentDocumentId++;
    const document: Document = {
      ...insertDocument,
      id,
      createdAt: new Date(),
    };
    this.documents.set(id, document);
    return document;
  }

  async deleteDocument(id: number): Promise<void> {
    this.documents.delete(id);
    // Also delete related conversations
    const relatedConversations = Array.from(this.conversations.values())
      .filter(conv => conv.documentId === id);
    
    for (const conv of relatedConversations) {
      // Delete messages in conversation
      const relatedMessages = Array.from(this.messages.values())
        .filter(msg => msg.conversationId === conv.id);
      
      for (const msg of relatedMessages) {
        this.messages.delete(msg.id);
      }
      
      this.conversations.delete(conv.id);
    }
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationBySession(sessionId: string): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values()).find(
      (conv) => conv.sessionId === sessionId,
    );
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = this.currentConversationId++;
    const conversation: Conversation = {
      ...insertConversation,
      id,
      documentId: insertConversation.documentId || null,
      createdAt: new Date(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getConversationMessages(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(msg => msg.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = {
      ...insertMessage,
      id,
      role: insertMessage.role as "user" | "assistant",
      sourceChunks: Array.isArray(insertMessage.sourceChunks) ? insertMessage.sourceChunks as string[] : null,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async getSettings(): Promise<Settings | null> {
    return this.settingsStore;
  }

  async upsertSettings(data: InsertSettings): Promise<Settings> {
    const existing = this.settingsStore;
    this.settingsStore = {
      id: existing?.id ?? 1,
      companyName: data.companyName ?? "AI Assistant",
      companyDescription: data.companyDescription ?? "",
      systemPrompt: data.systemPrompt ?? "",
      widgetGreeting: data.widgetGreeting ?? "Hi! I'm your AI assistant. How can I help you today?",
      primaryColor: data.primaryColor ?? "#2194f3",
      updatedAt: new Date(),
    };
    return this.settingsStore;
  }

  async getAnalytics(): Promise<AnalyticsData> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const allConvs = Array.from(this.conversations.values());
    const allMsgs = Array.from(this.messages.values());

    const countConvsSince = (d: Date) => allConvs.filter(c => c.createdAt >= d).length;
    const countMsgsSince = (d: Date) => allMsgs.filter(m => m.createdAt >= d).length;

    const msgCounts = allConvs.map(c => allMsgs.filter(m => m.conversationId === c.id).length);
    const avg = msgCounts.length ? msgCounts.reduce((a, b) => a + b, 0) / msgCounts.length : 0;

    const docs = Array.from(this.documents.values()).map(d => ({
      originalName: d.originalName,
      size: d.size,
      chunkCount: (d.chunks as string[]).length,
      createdAt: d.createdAt.toISOString(),
    }));

    const recentConvs = allConvs
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map(c => ({
        sessionId: c.sessionId,
        messageCount: allMsgs.filter(m => m.conversationId === c.id).length,
        createdAt: c.createdAt.toISOString(),
      }));

    return {
      totals: {
        conversations: allConvs.length,
        userMessages: allMsgs.filter(m => m.role === 'user').length,
        assistantMessages: allMsgs.filter(m => m.role === 'assistant').length,
        avgMessagesPerConversation: Math.round(avg * 10) / 10,
      },
      byPeriod: {
        today:     { conversations: countConvsSince(startOfToday), messages: countMsgsSince(startOfToday) },
        thisWeek:  { conversations: countConvsSince(startOfWeek),  messages: countMsgsSince(startOfWeek) },
        thisMonth: { conversations: countConvsSince(startOfMonth), messages: countMsgsSince(startOfMonth) },
        allTime:   { conversations: allConvs.length,               messages: allMsgs.length },
      },
      documents: docs,
      recentConversations: recentConvs,
    };
  }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  private db;

  constructor() {
    const sql = neon(process.env.DATABASE_URL!);
    this.db = drizzle(sql);
  }

  async getUser(id: number): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const result = await this.db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return result[0];
  }

  async createDocument(insertDocument: InsertDocument & { chunks: string[]; embeddings: number[][] }): Promise<Document> {
    const result = await this.db.insert(documents).values({
      ...insertDocument,
      chunks: insertDocument.chunks,
      embeddings: insertDocument.embeddings
    }).returning();
    return result[0];
  }

  async deleteDocument(id: number): Promise<void> {
    await this.db.delete(documents).where(eq(documents.id, id));
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const result = await this.db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return result[0];
  }

  async getConversationBySession(sessionId: string): Promise<Conversation | undefined> {
    const result = await this.db.select().from(conversations).where(eq(conversations.sessionId, sessionId)).limit(1);
    return result[0];
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const result = await this.db.insert(conversations).values(insertConversation).returning();
    return result[0];
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const result = await this.db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return result[0];
  }

  async getConversationMessages(conversationId: number): Promise<Message[]> {
    const result = await this.db.select().from(messages).where(eq(messages.conversationId, conversationId));
    return result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const messageData: InsertMessage = {
      content: insertMessage.content,
      conversationId: insertMessage.conversationId,
      role: insertMessage.role as "user" | "assistant",
      sourceChunks: Array.isArray(insertMessage.sourceChunks) ? insertMessage.sourceChunks as string[] : null
    };
    const result = await this.db.insert(messages).values(messageData).returning();
    return result[0];
  }

  async getSettings(): Promise<Settings | null> {
    const result = await this.db.select().from(settings).limit(1);
    return result[0] ?? null;
  }

  async upsertSettings(data: InsertSettings): Promise<Settings> {
    const existing = await this.getSettings();
    if (existing) {
      const result = await this.db.update(settings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(settings.id, existing.id))
        .returning();
      return result[0];
    }
    const result = await this.db.insert(settings).values(data).returning();
    return result[0];
  }

  async getAnalytics(): Promise<AnalyticsData> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [convTotal] = await this.db.select({ count: sql<number>`count(*)::int` }).from(conversations);
    const [msgUser]   = await this.db.select({ count: sql<number>`count(*)::int` }).from(messages).where(eq(messages.role, 'user'));
    const [msgAssist] = await this.db.select({ count: sql<number>`count(*)::int` }).from(messages).where(eq(messages.role, 'assistant'));

    const avgRows = await this.db.execute(sql`
      SELECT COALESCE(ROUND(AVG(msg_count)::numeric, 1), 0) as avg
      FROM (SELECT COUNT(*)::int as msg_count FROM messages GROUP BY conversation_id) t
    `);
    const avgMsgs = Number((avgRows.rows[0] as any)?.avg ?? 0);

    const [convToday]  = await this.db.select({ count: sql<number>`count(*)::int` }).from(conversations).where(gte(conversations.createdAt, startOfToday));
    const [convWeek]   = await this.db.select({ count: sql<number>`count(*)::int` }).from(conversations).where(gte(conversations.createdAt, startOfWeek));
    const [convMonth]  = await this.db.select({ count: sql<number>`count(*)::int` }).from(conversations).where(gte(conversations.createdAt, startOfMonth));
    const [msgToday]   = await this.db.select({ count: sql<number>`count(*)::int` }).from(messages).where(gte(messages.createdAt, startOfToday));
    const [msgWeek]    = await this.db.select({ count: sql<number>`count(*)::int` }).from(messages).where(gte(messages.createdAt, startOfWeek));
    const [msgMonth]   = await this.db.select({ count: sql<number>`count(*)::int` }).from(messages).where(gte(messages.createdAt, startOfMonth));

    const docs = await this.db.select({
      originalName: documents.originalName,
      size: documents.size,
      chunks: documents.chunks,
      createdAt: documents.createdAt,
    }).from(documents);

    const recentRows = await this.db.execute(sql`
      SELECT c.session_id, c.created_at, COUNT(m.id)::int as message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id, c.session_id, c.created_at
      ORDER BY c.created_at DESC
      LIMIT 10
    `);

    return {
      totals: {
        conversations: convTotal.count,
        userMessages: msgUser.count,
        assistantMessages: msgAssist.count,
        avgMessagesPerConversation: avgMsgs,
      },
      byPeriod: {
        today:     { conversations: convToday.count,  messages: msgToday.count },
        thisWeek:  { conversations: convWeek.count,   messages: msgWeek.count },
        thisMonth: { conversations: convMonth.count,  messages: msgMonth.count },
        allTime:   { conversations: convTotal.count,  messages: msgUser.count + msgAssist.count },
      },
      documents: docs.map(d => ({
        originalName: d.originalName,
        size: d.size,
        chunkCount: (d.chunks as string[]).length,
        createdAt: d.createdAt.toISOString(),
      })),
      recentConversations: (recentRows.rows as any[]).map(r => ({
        sessionId: r.session_id,
        messageCount: r.message_count,
        createdAt: new Date(r.created_at).toISOString(),
      })),
    };
  }
}

// Use database storage in production, memory storage in development
export const storage = process.env.NODE_ENV === 'production' 
  ? new DatabaseStorage() 
  : new MemStorage();
