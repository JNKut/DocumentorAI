import { promises as fs } from 'fs';
import path from 'path';

export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  let currentSize = 0;
  
  for (const sentence of sentences) {
    const sentenceLength = sentence.trim().length;
    
    if (currentSize + sentenceLength > chunkSize && currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
      
      // Handle overlap
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 6)); // Approximate word overlap
      currentChunk = overlapWords.join(' ') + ' ' + sentence.trim();
      currentSize = currentChunk.length;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence.trim();
      currentSize = currentChunk.length;
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 50); // Filter out very small chunks
}

export async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'text/plain') {
      return await fs.readFile(filePath, 'utf-8');
    }
    
    if (mimeType === 'application/pdf') {
      // For production, you would use a PDF parsing library like pdf-parse
      // For now, we'll return a placeholder that indicates PDF processing is needed
      throw new Error('PDF processing requires additional setup. Please convert to text format.');
    }
    
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // For production, you would use a library like mammoth.js
      throw new Error('DOCX processing requires additional setup. Please convert to text format.');
    }
    
    throw new Error(`Unsupported file type: ${mimeType}`);
  } catch (error) {
    throw new Error(`Failed to extract text from file: ${error.message}`);
  }
}

export function validateFileUpload(file: Express.Multer.File): { valid: boolean; error?: string } {
  const allowedMimeTypes = [
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload PDF, DOCX, or TXT files only.'
    };
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File too large. Maximum size is 10MB.'
    };
  }
  
  return { valid: true };
}
