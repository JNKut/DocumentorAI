import OpenAI from "openai";
import { storage } from "../storage";
import { buildSystemPrompt, buildReferenceMessage, type PromptSettings } from "./prompt";

// Chat model is configurable per deployment. Default switched from gpt-4o to
// gpt-4o-mini at Jonah's request (about 16x cheaper for short FAQ answers).
// Any model used here needs a matching entry in PRICING in storage.ts.
export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";
// OpenAI caps the number of inputs per embeddings request
const EMBEDDING_BATCH_SIZE = 100;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "",
  // Bound how long a hung request can block the chat widget, and let the SDK's
  // built-in exponential backoff retry transient failures (rate limits, 5xxs,
  // connection errors) before giving up.
  timeout: 30 * 1000,
  maxRetries: 2,
});

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts.slice(i, i + EMBEDDING_BATCH_SIZE),
      });

      if (response.usage) {
        storage.recordTokenUsage({
          model: EMBEDDING_MODEL,
          promptTokens: response.usage.prompt_tokens,
          completionTokens: 0,
          totalTokens: response.usage.total_tokens,
        }).catch(err => console.error("Failed to record token usage:", err));
      }

      embeddings.push(...response.data.map(item => item.embedding));
    }
    return embeddings;
  } catch (error) {
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateChatResponse(
  message: string,
  context: string[],
  conversationHistory: { role: "user" | "assistant"; content: string }[] = [],
  companySettings?: PromptSettings
): Promise<{ response: string; sourceChunks: string[] }> {
  try {
    // Behaviour rules and business facts always go in the system prompt;
    // retrieved excerpts go in their own message so the visitor's question is
    // sent as typed and the model isn't told to "use the information above".
    const reference = buildReferenceMessage(context);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: buildSystemPrompt(companySettings) },
      ...conversationHistory,
      ...(reference ? [{ role: "system" as const, content: reference }] : []),
      { role: "user", content: message }
    ];

    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      max_tokens: 500,
      temperature: 0.3,
    });

    if (response.usage) {
      storage.recordTokenUsage({
        model: CHAT_MODEL,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      }).catch(err => console.error("Failed to record token usage:", err));
    }

    return {
      response: response.choices[0].message.content || "I couldn't generate a response.",
      sourceChunks: context
    };
  } catch (error) {
    throw new Error(`Failed to generate chat response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export async function findRelevantChunks(
  query: string,
  documentChunks: string[],
  documentEmbeddings: number[][],
  topK: number = 3
): Promise<string[]> {
  if (documentChunks.length === 0) return [];

  try {
    const queryEmbedding = await generateEmbeddings([query]);
    const queryVector = queryEmbedding[0];

    const similarities = documentEmbeddings.map((embedding, index) => ({
      index,
      similarity: cosineSimilarity(queryVector, embedding),
      chunk: documentChunks[index]
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities
      .slice(0, topK)
      .filter(item => item.similarity > 0.1) // Lower threshold for knowledge base
      .map(item => item.chunk);
  } catch (error) {
    console.error('Error finding relevant chunks:', error);
    return [];
  }
}
