import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || ""
});

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });

    return response.data.map(item => item.embedding);
  } catch (error) {
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateChatResponse(
  message: string,
  context: string[],
  conversationHistory: { role: "user" | "assistant"; content: string }[] = []
): Promise<{ response: string; sourceChunks: string[] }> {
  try {
    const contextText = context.length > 0 
      ? `Relevant context from uploaded documents:\n${context.join('\n\n')}\n\n`
      : '';

    const systemPrompt = `You are an AI assistant that answers questions based on uploaded documents. 
${contextText ? 'Use the provided context to answer questions accurately. If the context doesn\'t contain relevant information, say so clearly.' : 'No documents have been uploaded yet. Let the user know they need to upload a document first to get contextual answers.'}
Be helpful, concise, and cite specific information from the documents when possible.`;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

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
      .filter(item => item.similarity > 0.3)
      .map(item => item.chunk);
  } catch (error) {
    console.error('Error finding relevant chunks:', error);
    return [];
  }
}
