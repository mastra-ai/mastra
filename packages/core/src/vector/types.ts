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

export type ParamTypes = {
  query: QueryVectorParams;
  upsert: UpsertVectorParams;
  createIndex: CreateIndexParams;
};

export type ParamsToArgs<T> = [string | T, ...Array<T[Exclude<keyof T, 'indexName'>]>];

export type ParamArgs = {
  query: ParamsToArgs<QueryVectorParams>;
  upsert: ParamsToArgs<UpsertVectorParams>;
  createIndex: ParamsToArgs<CreateIndexParams>;
};

export const PARAM_KEYS = {
  query: Object.keys({} as QueryVectorParams) as (keyof QueryVectorParams)[],
  upsert: Object.keys({} as UpsertVectorParams) as (keyof UpsertVectorParams)[],
  createIndex: Object.keys({} as CreateIndexParams) as (keyof CreateIndexParams)[],
} as const;
