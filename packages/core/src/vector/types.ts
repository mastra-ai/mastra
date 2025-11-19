import type { VectorFilter } from './filter';

/**
 * Generic sparse vector structure
 * Represents high-dimensional vectors with only non-zero values stored
 */
export interface SparseVector {
  /** Array of dimension indices for non-zero values */
  indices: number[];
  /** Array of values corresponding to the indices */
  values: number[];
}

export interface QueryResult {
  id: string;
  score: number;
  metadata?: Record<string, any>;
  vector?: number[];
  /**
   * The document content, if available.
   * Note: Currently only supported by Chroma vector store.
   * For other vector stores, documents should be stored in metadata.
   */
  document?: string;
}

export interface IndexStats {
  dimension: number;
  count: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}

export interface UpsertVectorParams<Filter = VectorFilter> {
  indexName: string;
  vectors: number[][];
  metadata?: Record<string, any>[];
  ids?: string[];
  /** Optional array of sparse vectors for hybrid search */
  sparseVectors?: SparseVector[];
  /**
   * Optional filter to delete vectors before upserting.
   * Useful for replacing all chunks from a source document.
   * The delete and insert operations happen atomically in a transaction.
   *
   * @example
   * ```ts
   * // Replace all chunks from a document
   * await vectorStore.upsert({
   *   indexName: 'docs',
   *   vectors: embeddings,
   *   metadata: chunks.map(c => ({ text: c.text, source_id: 'doc.pdf' })),
   *   deleteFilter: { source_id: 'doc.pdf' }
   * });
   * ```
   */
  deleteFilter?: Filter;
}

export interface CreateIndexParams {
  indexName: string;
  dimension: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}

export interface QueryVectorParams<Filter = VectorFilter> {
  indexName: string;
  queryVector: number[];
  topK?: number;
  filter?: Filter;
  includeVector?: boolean;
  /** Optional sparse vector for hybrid query */
  sparseVector?: SparseVector;
}

export interface DescribeIndexParams {
  indexName: string;
}

export interface DeleteIndexParams {
  indexName: string;
}

export interface UpdateVectorParams {
  indexName: string;
  id: string;
  update: { vector?: number[]; metadata?: Record<string, any> };
}

export interface DeleteVectorParams {
  indexName: string;
  id: string;
}

export interface DeleteVectorsByFilterParams<Filter = VectorFilter> {
  indexName: string;
  /**
   * Filter to match vectors for deletion.
   * Uses the same filter syntax as query operations.
   *
   * @example
   * ```ts
   * // Delete all chunks from a document
   * { source_id: 'document.pdf' }
   *
   * // Delete with multiple conditions
   * { $and: [{ tenant_id: 'acme' }, { bucket: 'temp' }] }
   * ```
   */
  filter: Filter;
}
