import { describe, it, expect } from "vitest";
import { chunkText } from "../services/document-processor";

describe("chunkText", () => {
  it("keeps prices, URLs and sentence punctuation intact", () => {
    const text = "Plans cost $49.99. Visit documentorai.org today! Questions?\n\nEmail support@acme.co for help.";
    expect(chunkText(text)).toEqual([
      "Plans cost $49.99. Visit documentorai.org today! Questions? Email support@acme.co for help.",
    ]);
  });

  it("splits long text into overlapping chunks near the size limit", () => {
    const text = Array.from({ length: 60 }, (_, i) => `Sentence ${i} is about pricing tier ${i}.`).join(" ");
    const chunks = chunkText(text, 500, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(600);
    // Every sentence survives somewhere
    for (let i = 0; i < 60; i++) {
      expect(chunks.some(c => c.includes(`Sentence ${i} is about pricing tier ${i}.`))).toBe(true);
    }
  });

  it("hard-splits text with no punctuation", () => {
    expect(chunkText("x".repeat(2500), 1000, 0).map(c => c.length)).toEqual([1000, 1000, 500]);
  });

  it("keeps short documents and drops empty ones", () => {
    expect(chunkText("We open at 9am.")).toEqual(["We open at 9am."]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });
});
