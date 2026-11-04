/**
 * Shared MongoDB connection config. One Atlas cluster backs BOTH the RAG vector
 * store AND the agent's memory/storage — the headline of this demo.
 */
export const MONGODB_URI = process.env.MONGODB_URI ?? '';
export const MONGODB_DATABASE = process.env.MONGODB_DATABASE ?? 'mastra_docs';

/** Atlas Vector Search index (collection) name for the docs embeddings. */
export const VECTOR_INDEX = 'mastra_docs_embeddings';

/** Key the vector store is registered under in the Mastra instance. */
export const VECTOR_STORE_NAME = 'mongoVector';

if (!MONGODB_URI) {
  // Surface a clear error early rather than a cryptic driver failure later.
  console.warn('[mongo] MONGODB_URI is not set. Copy .env.example to .env and set your Atlas connection string.');
}
