import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { makeApp, openaiMock } from "./helpers";

vi.mock("../services/openai", async () => (await import("./helpers")).openaiMock);

let app: Express;

beforeAll(async () => {
  process.env.DAILY_OPENAI_BUDGET_USD = "0";
  app = await makeApp();
});

describe("daily OpenAI budget", () => {
  it("replies with an unavailable message without calling OpenAI once the budget is spent", async () => {
    const sessionId = "budget-session-123";
    const conv = await request(app).post("/api/conversations").send({ sessionId });
    const res = await request(app)
      .post(`/api/conversations/${conv.body.id}/messages`)
      .send({ sessionId, content: "hello" });
    expect(res.status).toBe(200);
    expect(res.body.aiMessage.content).toMatch(/temporarily unavailable/);
    expect(openaiMock.generateChatResponse).not.toHaveBeenCalled();
    expect(openaiMock.findRelevantChunks).not.toHaveBeenCalled();
  });
});
