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
  /**
   * The query vector for similarity search.
   * Optional — when omitted, a metadata-only query is performed using `filter`.
   * At least one of `queryVector` or `filter` must be provided.
   *
   * Note: Not all vector store backends support metadata-only queries.
   * Check your store's documentation for support details.
   */
  queryVector?: number[];
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

/**
 * Parameters for updating vectors.
 * This is a discriminated union that enforces mutually exclusive use of `id` or `filter`.
 */
export type UpdateVectorParams<Filter = VectorFilter> =
  | {
      indexName: string;
      /**
       * Update a single vector by ID.
       */
      id: string;
      filter?: never;
      update: { vector?: number[]; metadata?: Record<string, any> };
    }
  | {
      indexName: string;
      id?: never;
      /**
       * Update multiple vectors matching a filter.
       *
       * @example
       * ```ts
       * // Archive all vectors for a user
       * await vectorStore.updateVector({
       *   indexName: 'docs',
       *   filter: { userId: 'user_42' },
       *   update: { metadata: { status: 'archived' } }
       * });
       * ```
       */
      filter: Filter;
      update: { vector?: number[]; metadata?: Record<string, any> };
    };

export interface DeleteVectorParams {
  indexName: string;
  id: string;
}

export interface DeleteVectorsParams<Filter = VectorFilter> {
  indexName: string;
  /**
   * Delete multiple vectors by their IDs.
   * Mutually exclusive with `filter`.
   *
   * @example
   * ```ts
   * await vectorStore.deleteVectors({
   *   indexName: 'docs',
   *   ids: ['vec_1', 'vec_2', 'vec_3']
   * });
   * ```
   */
  ids?: string[];
  /**
   * Delete vectors matching a metadata filter.
   * Mutually exclusive with `ids`.
   * Uses the same filter syntax as query operations.
   *
   * @example
   * ```ts
   * // Delete all chunks from a document
   * await vectorStore.deleteVectors({
   *   indexName: 'docs',
   *   filter: { source_id: 'document.pdf' }
   * });
   *
   * // Delete with multiple conditions
   * await vectorStore.deleteVectors({
   *   indexName: 'docs',
   *   filter: { $and: [{ tenant_id: 'acme' }, { bucket: 'temp' }] }
   * });
   * ```
   */
  filter?: Filter;
}
