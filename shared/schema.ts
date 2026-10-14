import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  content: text("content").notNull(),
  chunks: jsonb("chunks").$type<string[]>().notNull().default([]),
  embeddings: jsonb("embeddings").$type<number[][]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  documentId: integer("document_id").references(() => documents.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  role: text("role").$type<"user" | "assistant">().notNull(),
  content: text("content").notNull(),
  sourceChunks: jsonb("source_chunks").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tokenUsage = pgTable("token_usage", {
  id: serial("id").primaryKey(),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Structured business facts and behaviour options, filled in on the admin
// page so clients don't have to write a training document from scratch.
export const TONES = ["professional", "friendly", "casual"] as const;

export const businessProfileSchema = z.object({
  tone: z.enum(TONES).default("professional"),
  suggestNextStep: z.boolean().default(true),
  callToAction: z.string().trim().max(200).default(""),
  contactEmail: z.string().trim().max(200).default(""),
  contactPhone: z.string().trim().max(50).default(""),
  website: z.string().trim().max(200).default(""),
  hours: z.string().trim().max(300).default(""),
  location: z.string().trim().max(300).default(""),
  faqs: z.array(z.object({
    q: z.string().trim().min(1).max(200),
    a: z.string().trim().min(1).max(500),
  })).max(12, "At most 12 FAQs").default([]),
  avoidTopics: z.string().trim().max(1000).default(""),
});

export type BusinessProfile = z.infer<typeof businessProfileSchema>;

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default("AI Assistant"),
  companyDescription: text("company_description").notNull().default(""),
  systemPrompt: text("system_prompt").notNull().default(""),
  widgetGreeting: text("widget_greeting").notNull().default("Hi! I'm your AI assistant. How can I help you today?"),
  primaryColor: text("primary_color").notNull().default("#2194f3"),
  profile: jsonb("profile").$type<Partial<BusinessProfile>>().notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  filename: true,
  originalName: true,
  mimeType: true,
  size: true,
  content: true,
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  sessionId: true,
  documentId: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  role: true,
  content: true,
  sourceChunks: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export const insertSettingsSchema = createInsertSchema(settings, {
  companyName: (s) => s.max(100),
  companyDescription: (s) => s.max(2000),
  systemPrompt: (s) => s.max(8000),
  widgetGreeting: (s) => s.max(300),
  primaryColor: (s) => s.regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #2194f3"),
  profile: () => businessProfileSchema,
}).pick({
  companyName: true,
  companyDescription: true,
  systemPrompt: true,
  widgetGreeting: true,
  primaryColor: true,
  profile: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

export type TokenUsage = typeof tokenUsage.$inferSelect;
