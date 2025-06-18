import { promises as fs } from 'fs';
import path from 'path';
import { chunkText } from './document-processor';
import { generateEmbeddings } from './openai';
import { storage } from '../storage';

let knowledgeBaseId: number | null = null;

export async function initializeKnowledgeBase(): Promise<void> {
  try {
    // Check if knowledge base already exists
    if (knowledgeBaseId) return;

    // Read the knowledge base file
    const knowledgeBasePath = path.join(__dirname, '../knowledge-base.txt');
    const content = await fs.readFile(knowledgeBasePath, 'utf-8');
    
    // Process the knowledge base
    const chunks = chunkText(content);
    const embeddings = await generateEmbeddings(chunks);
    
    // Store as a document
    const document = await storage.createDocument({
      filename: 'knowledge-base.txt',
      originalName: 'AI Assistant Knowledge Base',
      mimeType: 'text/plain',
      size: content.length,
      content,
      chunks,
      embeddings
    });
    
    knowledgeBaseId = document.id;
    console.log(`Knowledge base initialized with ID: ${knowledgeBaseId}`);
  } catch (error) {
    console.error('Failed to initialize knowledge base:', error);
  }
}

export function getKnowledgeBaseId(): number | null {
  return knowledgeBaseId;
}