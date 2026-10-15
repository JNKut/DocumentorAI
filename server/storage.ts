import {
  users, documents, conversations, messages, settings, tokenUsage,
  type User, type InsertUser,
  type Document, type InsertDocument,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage,
  type Settings, type InsertSettings,
  type TokenUsage
} from "@shared/schema";
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { and, eq, gte, ne, desc, sql } from 'drizzle-orm';

// Published OpenAI pricing, USD per token. Verify against platform.openai.com/pricing if costs look off.
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
  'text-embedding-3-small': { input: 0.02 / 1_000_000, output: 0 },
};

// A model missing from PRICING is costed at the highest known rates, so the
// daily budget can't be silently disabled by switching OPENAI_CHAT_MODEL.
const FALLBACK_RATE = {
  input: Math.max(...Object.values(PRICING).map(r => r.input)),
  output: Math.max(...Object.values(PRICING).map(r => r.output)),
};
const warnedModels = new Set<string>();

export function costForModel(model: string, promptTokens: number, completionTokens: number): number {
  let rate = PRICING[model];
  if (!rate) {
    if (!warnedModels.has(model)) {
      warnedModels.add(model);
      console.warn(`No price for model "${model}" in PRICING; costing it at the highest known rates. Add its real price in server/storage.ts.`);
    }
    rate = FALLBACK_RATE;
  }
  return promptTokens * rate.input + completionTokens * rate.output;
}

export interface RecordTokenUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

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
  costs: {
    openai: {
      today: number;
      thisWeek: number;
      thisMonth: number;
      allTime: number;
    };
  };
}

export interface ConversationSummary {
  id: number;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
  preview: string;
}

const PREVIEW_CHARS = 120;

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getDocument(id: number): Promise<Document | undefined>;
  getLatestDocument(): Promise<Document | undefined>;
  createDocument(document: InsertDocument & { chunks: string[]; embeddings: number[][] }): Promise<Document>;
  deleteDocument(id: number): Promise<void>;
  deleteDocumentsExcept(id: number): Promise<void>;
  updateDocumentChunks(id: number, chunks: string[], embeddings: number[][]): Promise<void>;
  
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationBySession(sessionId: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  // Conversations with at least one message, most recently active first
  listConversations(limit: number, offset: number): Promise<{ items: ConversationSummary[]; total: number }>;
  deleteConversation(id: number): Promise<void>;
  // Conversations in which a visitor sent a message since the given date
  countActiveConversationsSince(d: Date): Promise<number>;
  
  getMessage(id: number): Promise<Message | undefined>;
  getConversationMessages(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  getSettings(): Promise<Settings | null>;
  upsertSettings(data: InsertSettings): Promise<Settings>;

  recordTokenUsage(entry: RecordTokenUsage): Promise<void>;
  openaiCostSince(d: Date): Promise<number>;
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
  private tokenUsageLog: TokenUsage[];
  private currentTokenUsageId: number;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.currentUserId = 1;
    this.currentDocumentId = 1;
    this.currentConversationId = 1;
    this.currentMessageId = 1;
    this.tokenUsageLog = [];
    this.currentTokenUsageId = 1;
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

  async getLatestDocument(): Promise<Document | undefined> {
    return Array.from(this.documents.values()).sort((a, b) => b.id - a.id)[0];
  }

  async deleteDocumentsExcept(id: number): Promise<void> {
    for (const docId of Array.from(this.documents.keys())) {
      if (docId !== id) await this.deleteDocument(docId);
    }
  }

  async updateDocumentChunks(id: number, chunks: string[], embeddings: number[][]): Promise<void> {
    const doc = this.documents.get(id);
    if (doc) this.documents.set(id, { ...doc, chunks, embeddings });
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

  async listConversations(limit: number, offset: number): Promise<{ items: ConversationSummary[]; total: number }> {
    const summaries: ConversationSummary[] = [];
    for (const conv of Array.from(this.conversations.values())) {
      const msgs = Array.from(this.messages.values())
        .filter(m => m.conversationId === conv.id)
        .sort((a, b) => a.id - b.id);
      if (msgs.length === 0) continue;
      summaries.push({
        id: conv.id,
        createdAt: conv.createdAt.toISOString(),
        lastMessageAt: msgs[msgs.length - 1].createdAt.toISOString(),
        messageCount: msgs.length,
        preview: (msgs.find(m => m.role === 'user')?.content ?? '').slice(0, PREVIEW_CHARS),
      });
    }
    summaries.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt) || b.id - a.id);
    return { items: summaries.slice(offset, offset + limit), total: summaries.length };
  }

  async deleteConversation(id: number): Promise<void> {
    for (const msg of Array.from(this.messages.values())) {
      if (msg.conversationId === id) this.messages.delete(msg.id);
    }
    this.conversations.delete(id);
  }

  async countActiveConversationsSince(d: Date): Promise<number> {
    const ids = new Set<number>();
    for (const msg of Array.from(this.messages.values())) {
      if (msg.role === 'user' && msg.createdAt >= d) ids.add(msg.conversationId);
    }
    return ids.size;
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
      // Fields left out of a save keep their current value, as in DatabaseStorage
      companyName: data.companyName ?? existing?.companyName ?? "AI Assistant",
      companyDescription: data.companyDescription ?? existing?.companyDescription ?? "",
      systemPrompt: data.systemPrompt ?? existing?.systemPrompt ?? "",
      widgetGreeting: data.widgetGreeting ?? existing?.widgetGreeting ?? "Hi! I'm your AI assistant. How can I help you today?",
      primaryColor: data.primaryColor ?? existing?.primaryColor ?? "#2194f3",
      profile: data.profile ?? existing?.profile ?? {},
      updatedAt: new Date(),
    };
    return this.settingsStore;
  }

  async recordTokenUsage(entry: RecordTokenUsage): Promise<void> {
    const id = this.currentTokenUsageId++;
    this.tokenUsageLog.push({
      id,
      model: entry.model,
      promptTokens: entry.promptTokens,
      completionTokens: entry.completionTokens,
      totalTokens: entry.totalTokens,
      createdAt: new Date(),
    });
  }

  async openaiCostSince(d: Date): Promise<number> {
    const byModel = new Map<string, { prompt: number; completion: number }>();
    for (const u of this.tokenUsageLog) {
      if (u.createdAt < d) continue;
      const cur = byModel.get(u.model) ?? { prompt: 0, completion: 0 };
      cur.prompt += u.promptTokens;
      cur.completion += u.completionTokens;
      byModel.set(u.model, cur);
    }
    let total = 0;
    for (const [model, { prompt, completion }] of Array.from(byModel.entries())) {
      total += costForModel(model, prompt, completion);
    }
    return total;
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
      costs: {
        openai: {
          today: await this.openaiCostSince(startOfToday),
          thisWeek: await this.openaiCostSince(startOfWeek),
          thisMonth: await this.openaiCostSince(startOfMonth),
          allTime: await this.openaiCostSince(new Date(0)),
        },
      },
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

  async getLatestDocument(): Promise<Document | undefined> {
    const result = await this.db.select().from(documents).orderBy(desc(documents.id)).limit(1);
    return result[0];
  }

  async deleteDocument(id: number): Promise<void> {
    // Detach conversations first so the foreign key doesn't block the delete
    await this.db.update(conversations).set({ documentId: null }).where(eq(conversations.documentId, id));
    await this.db.delete(documents).where(eq(documents.id, id));
  }

  async deleteDocumentsExcept(id: number): Promise<void> {
    await this.db.update(conversations).set({ documentId: null }).where(ne(conversations.documentId, id));
    await this.db.delete(documents).where(ne(documents.id, id));
  }

  async updateDocumentChunks(id: number, chunks: string[], embeddings: number[][]): Promise<void> {
    await this.db.update(documents).set({ chunks, embeddings }).where(eq(documents.id, id));
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const result = await this.db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return result[0];
  }

  async getConversationBySession(sessionId: string): Promise<Conversation | undefined> {
    const result = await this.db.select().from(conversations).where(eq(conversations.sessionId, sessionId)).orderBy(conversations.id).limit(1);
    return result[0];
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const result = await this.db.insert(conversations).values(insertConversation).returning();
    return result[0];
  }

  async listConversations(limit: number, offset: number): Promise<{ items: ConversationSummary[]; total: number }> {
    const rows = await this.db.execute(sql`
      SELECT c.id, c.created_at,
        MAX(m.created_at) AS last_message_at,
        COUNT(m.id)::int AS message_count,
        (SELECT LEFT(um.content, ${PREVIEW_CHARS}) FROM messages um
          WHERE um.conversation_id = c.id AND um.role = 'user'
          ORDER BY um.id LIMIT 1) AS preview
      FROM conversations c
      JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id, c.created_at
      ORDER BY MAX(m.created_at) DESC, c.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    const [total] = await this.db
      .select({ count: sql<number>`count(distinct ${messages.conversationId})::int` })
      .from(messages);
    return {
      items: (rows.rows as any[]).map(r => ({
        id: r.id,
        createdAt: new Date(r.created_at).toISOString(),
        lastMessageAt: new Date(r.last_message_at).toISOString(),
        messageCount: r.message_count,
        preview: r.preview ?? '',
      })),
      total: total.count,
    };
  }

  async deleteConversation(id: number): Promise<void> {
    await this.db.delete(messages).where(eq(messages.conversationId, id));
    await this.db.delete(conversations).where(eq(conversations.id, id));
  }

  async countActiveConversationsSince(d: Date): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(distinct ${messages.conversationId})::int` })
      .from(messages)
      .where(and(eq(messages.role, 'user'), gte(messages.createdAt, d)));
    return row.count;
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
    const result = await this.db.insert(messages).values({
      content: insertMessage.content,
      conversationId: insertMessage.conversationId,
      role: insertMessage.role as "user" | "assistant",
      sourceChunks: Array.isArray(insertMessage.sourceChunks) ? insertMessage.sourceChunks as string[] : null
    }).returning();
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

  async recordTokenUsage(entry: RecordTokenUsage): Promise<void> {
    await this.db.insert(tokenUsage).values({
      model: entry.model,
      promptTokens: entry.promptTokens,
      completionTokens: entry.completionTokens,
      totalTokens: entry.totalTokens,
    });
  }

  async openaiCostSince(d: Date): Promise<number> {
    const rows = await this.db.select({
      model: tokenUsage.model,
      promptTokens: sql<number>`coalesce(sum(${tokenUsage.promptTokens}), 0)::int`,
      completionTokens: sql<number>`coalesce(sum(${tokenUsage.completionTokens}), 0)::int`,
    }).from(tokenUsage).where(gte(tokenUsage.createdAt, d)).groupBy(tokenUsage.model);

    return rows.reduce((total, r) => total + costForModel(r.model, r.promptTokens, r.completionTokens), 0);
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
      costs: {
        openai: {
          today: await this.openaiCostSince(startOfToday),
          thisWeek: await this.openaiCostSince(startOfWeek),
          thisMonth: await this.openaiCostSince(startOfMonth),
          allTime: await this.openaiCostSince(new Date(0)),
        },
      },
    };
  }
}

// Use database storage in production, memory storage in development
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set in production');
}
if (process.env.NODE_ENV !== 'production') {
  console.warn('Using in-memory storage (NODE_ENV is not "production"); data will be lost on restart.');
}
export const storage = process.env.NODE_ENV === 'production'
  ? new DatabaseStorage()
  : new MemStorage();
