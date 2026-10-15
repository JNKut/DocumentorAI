import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildReferenceMessage, contactRoute } from "../services/prompt";
import { businessProfileSchema } from "@shared/schema";

const defaults = businessProfileSchema.parse({});

describe("buildSystemPrompt", () => {
  it("always includes the built-in rules, even with no settings", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Answer only what was asked");
    expect(prompt).toContain("ask one short clarifying question");
    expect(prompt).toContain("Never mention documents, a knowledge base");
    expect(prompt).toContain("contact this company directly");
    expect(prompt).toContain("Tone: professional");
    expect(prompt).toContain("say you are the AI assistant for this company");
  });

  it("applies the chosen tone", () => {
    expect(buildSystemPrompt({ profile: { tone: "casual" } })).toContain("Tone: casual");
    expect(buildSystemPrompt({ profile: { tone: "friendly" } })).toContain("Tone: friendly");
  });

  it("includes business facts and FAQs", () => {
    const prompt = buildSystemPrompt({
      companyName: "Acme",
      companyDescription: "We print hoodies.",
      profile: {
        contactEmail: "hi@acme.test", hours: "9 to 5", location: "Asbury Park",
        faqs: [{ q: "Minimum order?", a: "No minimum." }],
      },
    });
    expect(prompt).toContain("About Acme: We print hoodies.");
    expect(prompt).toContain("Email: hi@acme.test");
    expect(prompt).toContain("Hours: 9 to 5");
    expect(prompt).toContain("Location / service area: Asbury Park");
    expect(prompt).toContain("Q: Minimum order?\nA: No minimum.");
    expect(prompt).toContain("they can email hi@acme.test");
  });

  it("adds the call to action only when enabled and filled in", () => {
    const cta = "Book at acme.test/book";
    expect(buildSystemPrompt({ profile: { callToAction: cta } })).toContain(cta);
    expect(buildSystemPrompt({ profile: { callToAction: cta, suggestNextStep: false } })).not.toContain(cta);
    expect(buildSystemPrompt({ profile: { suggestNextStep: true } })).not.toContain("Next step:");
  });

  it("puts the business's own instructions after the built-in rules", () => {
    const prompt = buildSystemPrompt({ systemPrompt: "Always mention our summer sale." });
    expect(prompt.indexOf("Always mention our summer sale.")).toBeGreaterThan(prompt.indexOf("Answer only what was asked"));
    expect(prompt).toContain("unless they conflict with the rules above");
  });

  it("lists topics to avoid", () => {
    expect(buildSystemPrompt({ profile: { avoidTopics: "Supplier names" } })).toContain("Supplier names");
  });

  it("ignores an invalid stored profile rather than failing", () => {
    expect(buildSystemPrompt({ profile: { tone: "rude" } as any })).toContain("Tone: professional");
  });
});

describe("contactRoute", () => {
  it("prefers email, then phone, then website, then the company", () => {
    expect(contactRoute("Acme", { ...defaults, contactEmail: "a@b.c", contactPhone: "1", website: "w" })).toBe("email a@b.c");
    expect(contactRoute("Acme", { ...defaults, contactPhone: "555", website: "w" })).toBe("call 555");
    expect(contactRoute("Acme", { ...defaults, website: "acme.test" })).toBe("get in touch through acme.test");
    expect(contactRoute("Acme", defaults)).toBe("contact Acme directly");
  });
});

describe("buildReferenceMessage", () => {
  it("returns nothing without excerpts and wraps excerpts otherwise", () => {
    expect(buildReferenceMessage([])).toBeNull();
    const msg = buildReferenceMessage(["one", "two"])!;
    expect(msg).toContain("one\n\n---\n\ntwo");
    expect(msg).toContain("don't mention that these excerpts exist");
  });
});

describe("costForModel", () => {
  it("prices known models and never treats an unknown model as free", async () => {
    const { costForModel } = await import("../storage");
    expect(costForModel("gpt-4o-mini", 1_000_000, 1_000_000)).toBeCloseTo(0.75);
    expect(costForModel("gpt-4o", 1_000_000, 0)).toBeCloseTo(2.5);
    // Unknown models are costed at the highest known rates (gpt-4o here)
    expect(costForModel("some-new-model", 1_000_000, 1_000_000)).toBeCloseTo(12.5);
  });
});
