import { 
  users, documents, conversations, messages,
  type User, type InsertUser,
  type Document, type InsertDocument,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage
} from "@shared/schema";
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';

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
}

// Use database storage in production, memory storage in development
export const storage = process.env.NODE_ENV === 'production' 
  ? new DatabaseStorage() 
  : new MemStorage();
