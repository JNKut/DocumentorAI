import { promises as fs } from 'fs';
import path from 'path';
// Import the inner lib directly — pdf-parse's index.js has a debug harness
// keyed on `!module.parent` that misfires under ESM/tsx and crashes on load.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';

export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
  if (!normalized) return [];

  // Split after sentence-ending punctuation followed by whitespace (or at
  // paragraph breaks), keeping the punctuation, so "$49.99" and URLs survive.
  const sentences: string[] = [];
  for (const piece of normalized.split(/(?<=[.!?])\s+|\n{2,}/)) {
    const sentence = piece.replace(/\s+/g, ' ').trim();
    // Hard-split anything longer than a chunk (e.g. text with no punctuation)
    for (let i = 0; i < sentence.length; i += chunkSize) {
      sentences.push(sentence.slice(i, i + chunkSize));
    }
  }

  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk && currentChunk.length + 1 + sentence.length > chunkSize) {
      chunks.push(currentChunk);

      // Carry the tail of the previous chunk over, starting on a word boundary
      const tail = overlap > 0 ? currentChunk.slice(-overlap) : '';
      const firstSpace = tail.indexOf(' ');
      const carried = firstSpace >= 0 ? tail.slice(firstSpace + 1) : tail;
      currentChunk = carried ? carried + ' ' + sentence : sentence;
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'text/plain') {
      return await fs.readFile(filePath, 'utf-8');
    }

    if (mimeType === 'application/pdf') {
      const buffer = await fs.readFile(filePath);
      const data = await pdfParse(buffer);
      if (!data.text.trim()) {
        throw new Error('No extractable text found in PDF (it may be a scanned image).');
      }
      return data.text;
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ path: filePath });
      if (!result.value.trim()) {
        throw new Error('No extractable text found in DOCX file.');
      }
      return result.value;
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
  } catch (error) {
    throw new Error(`Failed to extract text from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
