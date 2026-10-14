// Re-chunk and re-embed the active knowledge base from its stored text.
// Run once per database after a chunking change, before deploying, so the
// new server process loads the rebuilt chunks:
//   npm run kb:rebuild                                   (uses .env DATABASE_URL)
//   DATABASE_URL="<other-db-url>" npm run kb:rebuild
import { storage } from "../server/storage";
import { chunkText } from "../server/services/document-processor";
import { generateEmbeddings } from "../server/services/openai";

async function main() {
  const doc = await storage.getLatestDocument();
  if (!doc) {
    console.log("No knowledge base document found; nothing to rebuild.");
    return;
  }

  const chunks = chunkText(doc.content);
  console.log(`"${doc.originalName}" (id ${doc.id}): ${doc.chunks.length} chunks -> ${chunks.length}`);
  const embeddings = await generateEmbeddings(chunks);
  await storage.updateDocumentChunks(doc.id, chunks, embeddings);
  console.log("Rebuilt. Restart or redeploy the service so it reloads the knowledge base.");
}

main().then(
  () => process.exit(0),
  err => {
    console.error(err);
    process.exit(1);
  },
);
