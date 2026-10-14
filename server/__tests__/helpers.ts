import express from "express";
import { vi } from "vitest";

export const ADMIN_PASSWORD = "test-admin-password";
export const admin = { Authorization: `Bearer ${ADMIN_PASSWORD}` };

// Stand-in for server/services/openai so tests never call OpenAI
export const openaiMock = {
  generateEmbeddings: vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0])),
  generateChatResponse: vi.fn(async (_message: string, context: string[]) => ({
    response: "mock reply",
    sourceChunks: context,
  })),
  findRelevantChunks: vi.fn(async (_q: string, chunks: string[]) => chunks.slice(0, 3)),
};

export async function makeApp() {
  process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  const { registerRoutes } = await import("../routes");
  const app = express();
  app.set("trust proxy", 1); // as in server/index.ts, behind Railway's proxy
  app.use(express.json({ limit: "50kb" }));
  await registerRoutes(app);
  return app;
}
