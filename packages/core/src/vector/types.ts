import type { Filter } from '../filter';

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

export interface UpsertVectorParams {
  indexName: string;
  vectors: number[][];
  metadata?: Record<string, any>[];
  ids?: string[];
}

export interface CreateIndexParams {
  indexName: string;
  dimension: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}

export type VectorFilter = Filter | null | undefined;

export interface QueryVectorParams {
  indexName: string;
  queryVector: number[];
  topK?: number;
  filter?: VectorFilter;
  includeVector?: boolean;
}
