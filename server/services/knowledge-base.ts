import type { Document } from '@shared/schema';
import { storage } from '../storage';

export interface KnowledgeBase {
  id: number;
  originalName: string;
  size: number;
  createdAt: Date;
  chunks: string[];
  embeddings: number[][];
}

// The active knowledge base is the most recently uploaded document. It is
// loaded from storage on first use (so it survives restarts and deploys) and
// cached in memory so chat requests don't re-read the embeddings every time.
let cached: KnowledgeBase | null = null;
let loaded = false;
let loading: Promise<KnowledgeBase | null> | null = null;

function toKnowledgeBase(doc: Document): KnowledgeBase {
  return {
    id: doc.id,
    originalName: doc.originalName,
    size: doc.size,
    createdAt: doc.createdAt,
    chunks: doc.chunks,
    embeddings: doc.embeddings,
  };
}

export async function getKnowledgeBase(): Promise<KnowledgeBase | null> {
  if (loaded) return cached;
  if (!loading) {
    loading = storage.getLatestDocument()
      .then(doc => {
        // An upload may have landed while this read was in flight; keep it
        if (!loaded) {
          cached = doc ? toKnowledgeBase(doc) : null;
          loaded = true;
        }
        return cached;
      })
      .finally(() => { loading = null; });
  }
  return loading;
}

export function setKnowledgeBase(doc: Document): void {
  cached = toKnowledgeBase(doc);
  loaded = true;
}
