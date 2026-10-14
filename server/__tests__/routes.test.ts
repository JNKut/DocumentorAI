import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { makeApp, admin, openaiMock } from "./helpers";

vi.mock("../services/openai", async () => (await import("./helpers")).openaiMock);

let app: Express;
let sessionCounter = 0;
const newSession = () => `test-session-${++sessionCounter}-${Date.now()}`;

async function startConversation() {
  const sessionId = newSession();
  // Distinct client IP per conversation so the suite stays under the per-IP limit
  const res = await request(app).post("/api/conversations")
    .set("X-Forwarded-For", `10.0.0.${sessionCounter}`)
    .send({ sessionId });
  expect(res.status).toBe(200);
  return { sessionId, id: res.body.id as number };
}

beforeAll(async () => {
  app = await makeApp();
});

describe("public chat API", () => {
  it("serves a health check", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("rate-limits conversation creation per IP", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app).post("/api/conversations")
        .set("X-Forwarded-For", "10.9.9.9")
        .send({ sessionId: `limit-test-${i}-session` });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every(s => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("rejects bad session IDs when creating a conversation", async () => {
    expect((await request(app).post("/api/conversations").send({ sessionId: "short" })).status).toBe(400);
    expect((await request(app).post("/api/conversations").send({ sessionId: "a".repeat(101) })).status).toBe(400);
  });

  it("returns the same conversation for the same session", async () => {
    const { sessionId, id } = await startConversation();
    const again = await request(app).post("/api/conversations").send({ sessionId });
    expect(again.body.id).toBe(id);
  });

  it("enforces the message length cap", async () => {
    const { sessionId, id } = await startConversation();
    const res = await request(app)
      .post(`/api/conversations/${id}/messages`)
      .send({ sessionId, content: "a".repeat(2001) });
    expect(res.status).toBe(400);
    expect(openaiMock.generateChatResponse).not.toHaveBeenCalled();
  });

  it("rejects another session reading or writing a conversation", async () => {
    const { id } = await startConversation();
    const write = await request(app)
      .post(`/api/conversations/${id}/messages`)
      .send({ sessionId: "someone-else-123", content: "hi" });
    expect(write.status).toBe(403);
    const read = await request(app).get(`/api/conversations/${id}/messages?sessionId=someone-else-123`);
    expect(read.status).toBe(403);
  });

  it("answers a message and hides internal fields", async () => {
    const { sessionId, id } = await startConversation();
    const res = await request(app)
      .post(`/api/conversations/${id}/messages`)
      .send({ sessionId, content: "What are your hours?" });
    expect(res.status).toBe(200);
    expect(res.body.aiMessage.content).toBe("mock reply");
    expect(res.body.aiMessage).not.toHaveProperty("sourceChunks");

    const history = await request(app).get(`/api/conversations/${id}/messages?sessionId=${sessionId}`);
    expect(history.body.map((m: any) => m.role)).toEqual(["user", "assistant"]);
  });

  it("does not send the current message twice to the model", async () => {
    const { sessionId, id } = await startConversation();
    openaiMock.generateChatResponse.mockClear();
    await request(app).post(`/api/conversations/${id}/messages`).send({ sessionId, content: "first" });
    await request(app).post(`/api/conversations/${id}/messages`).send({ sessionId, content: "second" });
    const [message, , history] = openaiMock.generateChatResponse.mock.calls[1] as any[];
    expect(message).toBe("second");
    expect(history.map((h: any) => h.content)).toEqual(["first", "mock reply"]);
  });

  it("caps the number of messages in a conversation", async () => {
    const { storage } = await import("../storage");
    const { sessionId, id } = await startConversation();
    for (let i = 0; i < 100; i++) {
      await storage.createMessage({ conversationId: id, role: i % 2 ? "assistant" : "user", content: `m${i}`, sourceChunks: [] });
    }
    const res = await request(app).post(`/api/conversations/${id}/messages`).send({ sessionId, content: "one more" });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("conversation_limit");
  });
});

describe("admin API", () => {
  it("requires the admin password", async () => {
    expect((await request(app).get("/api/admin/settings")).status).toBe(401);
    expect((await request(app).get("/api/admin/conversations")).status).toBe(401);
  });

  it("validates settings", async () => {
    const bad = await request(app).post("/api/admin/settings").set(admin).send({ primaryColor: "red" });
    expect(bad.status).toBe(400);
    const good = await request(app).post("/api/admin/settings").set(admin).send({ companyName: "Acme", primaryColor: "#123456" });
    expect(good.status).toBe(200);
    const config = await request(app).get("/api/widget/config");
    expect(config.body.companyName).toBe("Acme");
  });

  it("validates and stores the business profile, and passes it to the model", async () => {
    const badTone = await request(app).post("/api/admin/settings").set(admin)
      .send({ companyName: "Acme", profile: { tone: "rude" } });
    expect(badTone.status).toBe(400);
    const tooManyFaqs = await request(app).post("/api/admin/settings").set(admin)
      .send({ companyName: "Acme", profile: { faqs: Array.from({ length: 13 }, () => ({ q: "q", a: "a" })) } });
    expect(tooManyFaqs.status).toBe(400);

    const profile = { tone: "friendly", contactEmail: "hi@acme.test", faqs: [{ q: "Minimum order?", a: "None." }] };
    const saved = await request(app).post("/api/admin/settings").set(admin).send({ companyName: "Acme", profile });
    expect(saved.status).toBe(200);
    const loaded = await request(app).get("/api/admin/settings").set(admin);
    expect(loaded.body.profile).toMatchObject(profile);
    expect(loaded.body.profile.suggestNextStep).toBe(true);

    const { sessionId, id } = await startConversation();
    openaiMock.generateChatResponse.mockClear();
    await request(app).post(`/api/conversations/${id}/messages`).send({ sessionId, content: "hello" });
    const [, , , settings] = openaiMock.generateChatResponse.mock.calls[0] as any[];
    expect(settings.profile).toMatchObject(profile);
  });

  it("uploads a knowledge base, replacing the previous one, and uses it in chat", async () => {
    const upload = (text: string, name: string) =>
      request(app).post("/api/admin/knowledge-base").set(admin)
        .attach("file", Buffer.from(text), { filename: name, contentType: "text/plain" });

    expect((await upload("Old hoodies cost $10.00.", "old.txt")).status).toBe(200);
    const res = await upload("The Premium hoodie costs $59.50. Returns are accepted for 30 days.", "kb.txt");
    expect(res.status).toBe(200);
    expect(res.body.chunks).toBe(1);

    const kb = await request(app).get("/api/admin/knowledge-base").set(admin);
    expect(kb.body.originalName).toBe("kb.txt");
    const analytics = await request(app).get("/api/admin/analytics").set(admin);
    expect(analytics.body.documents).toHaveLength(1);

    const { sessionId, id } = await startConversation();
    openaiMock.generateChatResponse.mockClear();
    await request(app).post(`/api/conversations/${id}/messages`).send({ sessionId, content: "How much is premium?" });
    const [, context] = openaiMock.generateChatResponse.mock.calls[0] as any[];
    expect(context[0]).toContain("$59.50");
  });

  it("rejects an empty knowledge base file", async () => {
    const res = await request(app).post("/api/admin/knowledge-base").set(admin)
      .attach("file", Buffer.from("   "), { filename: "empty.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });

  it("lists, shows and deletes conversations, and reports usage", async () => {
    const { sessionId, id } = await startConversation();
    await request(app).post(`/api/conversations/${id}/messages`).send({ sessionId, content: "Do you ship to Canada?" });

    const list = await request(app).get("/api/admin/conversations").set(admin);
    expect(list.status).toBe(200);
    const entry = list.body.items.find((c: any) => c.id === id);
    expect(entry.preview).toBe("Do you ship to Canada?");
    expect(entry.messageCount).toBe(2);

    const transcript = await request(app).get(`/api/admin/conversations/${id}/messages`).set(admin);
    expect(transcript.body).toHaveLength(2);

    const usage = await request(app).get("/api/admin/usage").set(admin);
    expect(usage.body.conversationsThisMonth).toBeGreaterThan(0);

    expect((await request(app).delete(`/api/admin/conversations/${id}`).set(admin)).status).toBe(200);
    const after = await request(app).get("/api/admin/conversations").set(admin);
    expect(after.body.items.find((c: any) => c.id === id)).toBeUndefined();
    const gone = await request(app).get(`/api/conversations/${id}/messages?sessionId=${sessionId}`);
    expect(gone.status).toBe(404);
  });

  // Runs last: it locks this IP out of the admin API
  it("locks out an IP after 10 failed logins", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await request(app).get("/api/admin/settings").set({ Authorization: "Bearer wrong" })).status).toBe(401);
    }
    expect((await request(app).get("/api/admin/settings").set(admin)).status).toBe(429);
  });
});
