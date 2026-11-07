import type { AgentMemory as AgentMemoryClient, AgentMemoryFileInput } from '@surrealdb/memory';

/**
 * Thin, dependency-free helpers over Agent Memory's `documents` namespace for RAG
 * ingestion and retrieval pipelines. The retrieval helper ({@link searchDocuments})
 * is also exposed as the `agentMemorySearchDocuments` agent tool.
 */

/** Ingest a document into the Agent Memory corpus. Returns the ingestion handle. */
export function ingestDocument(
  agentMemory: AgentMemoryClient,
  options: { file: AgentMemoryFileInput; title?: string; mimeType?: string },
) {
  return agentMemory.documents.upload(options);
}

/** Retrieval mode for {@link searchDocuments}. */
export type DocumentQueryMode = 'hybrid' | 'vector' | 'bm25' | 'hybrid_graph';

/** Hybrid/vector/BM25/graph search over the document corpus. */
export function searchDocuments(
  agentMemory: AgentMemoryClient,
  options: { query: string; k?: number; mode?: DocumentQueryMode },
) {
  return agentMemory.documents.query({
    query: options.query,
    k: options.k,
    mode: options.mode,
  });
}

/** List documents, optionally filtered by status/mime type. */
export function listDocuments(
  agentMemory: AgentMemoryClient,
  options?: {
    status?: string;
    mimeType?: string;
    page?: number;
    pageSize?: number;
  },
) {
  return agentMemory.documents.list(options);
}

/** Delete a document from the corpus. */
export function deleteDocument(agentMemory: AgentMemoryClient, documentId: string) {
  return agentMemory.documents.delete(documentId);
}
