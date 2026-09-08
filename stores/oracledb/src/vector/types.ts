import type { CreateIndexParams, QueryVectorParams, VectorFilter } from '@mastra/core/vector';

import type { OracleConnectionConfig, OraclePoolManager } from '../shared/connection';

// Public vector configuration types are kept Oracle-specific while matching Mastra's provider contracts.
export type OracleMetric = 'cosine' | 'euclidean' | 'dotproduct' | 'hamming' | 'jaccard';
export type OracleVectorIndexType = 'hnsw' | 'ivf' | 'none';
export type OracleVectorFormat = 'vector' | 'bit' | 'int8';
export type OracleQueryMode = 'approx' | 'exact';
export type OracleVectorMemoryScope = 'MEMORY' | 'SPFILE' | 'BOTH';

export type OracleVectorFilter = VectorFilter;

// Mirrors Oracle's VECTOR INDEX options without leaking SQL syntax into caller code.
export interface OracleVectorIndexConfig {
  type?: OracleVectorIndexType;
  accuracy?: number;
  hnsw?: {
    neighbors?: number;
    efConstruction?: number;
  };
  ivf?: {
    neighborPartitions?: number;
  };
}

// Optional DBA/setup helper for local or self-managed databases that need Vector Pool memory before HNSW builds.
export interface OracleVectorMemoryConfig {
  size: string;
  scope?: OracleVectorMemoryScope;
}

// Pool injection lets OracleStore and OracleVector share lifecycle in production deployments.
export interface OracleVectorConfig extends OracleConnectionConfig {
  id: string;
  poolManager?: OraclePoolManager;
  schemaName?: string;
  tablePrefix?: string;
  registryTableName?: string;
  defaultIndexConfig?: OracleVectorIndexConfig;
  defaultMetadataIndexes?: string[];
  defaultVectorFormat?: OracleVectorFormat;
  /**
   * Number of vectors to send per Oracle executeMany call. A single upsert
   * operation still commits once after all batches succeed.
   */
  upsertBatchSize?: number;
}

// Build and rebuild are explicit so index creation can stay fast in migration paths.
export interface OracleBuildIndexParams {
  indexName: string;
  metric?: OracleMetric;
  indexConfig?: OracleVectorIndexConfig;
}

// vectorFormat intentionally exposes only the production formats this adapter validates end to end.
export interface OracleCreateIndexParams extends Omit<CreateIndexParams, 'metric'> {
  metric?: OracleMetric;
  vectorFormat?: OracleVectorFormat;
  indexConfig?: OracleVectorIndexConfig;
  buildIndex?: boolean;
  metadataIndexes?: string[];
}

// Query mode maps to Oracle's exact/approx fetch behavior while preserving Mastra query options.
export interface OracleQueryVectorParams extends QueryVectorParams<OracleVectorFilter> {
  minScore?: number;
  queryMode?: OracleQueryMode;
  targetAccuracy?: number;
}

// Oracle returns storage details that Mastra's generic IndexStats does not currently model.
export interface OracleIndexStats {
  indexName: string;
  tableName: string;
  dimension: number;
  count: number;
  metric: OracleMetric;
  indexType: OracleVectorIndexType;
  vectorFormat: OracleVectorFormat;
  accuracy?: number;
}

export interface OracleRebuildIndexParams extends OracleBuildIndexParams {}

export interface OracleConfigureVectorMemoryParams extends OracleVectorMemoryConfig {}

// Status helpers report steady-state catalog status after synchronous index builds complete.
export interface OracleIndexStatusParams {
  indexName: string;
  ownerName?: string;
}

// Accuracy queries are Oracle-specific diagnostics for approximate vector indexes.
export interface OracleIndexAccuracyParams {
  indexName: string;
  queryVector: number[];
  topK: number;
  targetAccuracy?: number;
}
