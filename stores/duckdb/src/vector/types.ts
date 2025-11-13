/**
 * DuckDB Vector Store Type Definitions
 */

import type { VectorFilter as BaseVectorFilter } from '@mastra/core/vector/filter';

/**
 * Configuration options for DuckDB Vector store
 */
export interface DuckDBVectorConfig {
  /**
   * Unique identifier for this vector store instance
   * @default 'duckdb-vector'
   */
  id?: string;

  /**
   * Path to DuckDB database file
   * Use ':memory:' for in-memory database
   * @default ':memory:'
   */
  path?: string;

  /**
   * Vector dimensions for validation
   * @default 512
   */
  dimensions?: number;

  /**
   * Default similarity metric
   * @default 'cosine'
   */
  metric?: 'cosine' | 'euclidean' | 'dot';

  /**
   * Connection pool size
   * @default 5
   */
  poolSize?: number;

  /**
   * Memory limit for DuckDB (e.g., '2GB', '512MB')
   * @default '2GB'
   */
  memoryLimit?: string;

  /**
   * Number of threads for DuckDB
   * @default 4
   */
  threads?: number;

  /**
   * Enable read-only mode
   * @default false
   */
  readOnly?: boolean;

  /**
   * Custom extensions to load
   * @default ['vss']
   */
  extensions?: string[];
}

/**
 * Connection options for DuckDB
 */
export interface DuckDBConnectionOptions {
  access_mode?: 'automatic' | 'read_only' | 'read_write';
  max_memory?: string;
  threads?: number;
  temp_directory?: string;
  collation?: string;
  default_order?: 'asc' | 'desc';
  default_null_order?: 'nulls_first' | 'nulls_last';
}

/**
 * HNSW index configuration options
 */
export interface DuckDBIndexOptions {
  /**
   * Number of bi-directional links created for each node
   * Higher values increase accuracy but use more memory
   * @default 16
   */
  M?: number;

  /**
   * Size of the dynamic list for nearest neighbors
   * Higher values increase construction time but improve quality
   * @default 128
   */
  ef_construction?: number;

  /**
   * Size of the dynamic list for search
   * Higher values increase search accuracy but decrease speed
   * @default 64
   */
  ef_search?: number;

  /**
   * Distance metric for similarity calculation
   * @default 'cosine'
   */
  metric?: 'cosine' | 'euclidean' | 'dot';
}

/**
 * Query options specific to DuckDB
 */
export interface DuckDBQueryOptions {
  /**
   * Number of nearest neighbors to return
   * @default 10
   */
  topK?: number;

  /**
   * Enable hybrid search combining vector and FTS
   * @default false
   */
  hybridSearch?: boolean;

  /**
   * Text query for hybrid search
   */
  textQuery?: string;

  /**
   * Weight for vector similarity in hybrid search (0-1)
   * @default 0.7
   */
  vectorWeight?: number;

  /**
   * Include distance/similarity scores in results
   * @default true
   */
  includeDistances?: boolean;

  /**
   * Rerank results using a different metric
   */
  rerankMetric?: 'cosine' | 'euclidean' | 'dot';
}

/**
 * DuckDB-specific filter extensions
 */
export type DuckDBVectorFilter = BaseVectorFilter & {
  /**
   * Full-text search query
   */
  textSearch?: string;

  /**
   * JSON path expressions for metadata filtering
   * @example { "metadata->>'category'": "documentation" }
   */
  jsonPath?: Record<string, any>;

  /**
   * Raw SQL WHERE clause (use with caution)
   */
  rawSql?: string;

  /**
   * Date range filters
   */
  dateRange?: {
    field: string;
    start?: Date | string;
    end?: Date | string;
  };
};

/**
 * Statistics about a DuckDB vector index
 */
export interface DuckDBIndexStats {
  name: string;
  dimension: number;
  metric: string;
  totalVectors: number;
  indexType: 'HNSW';
  M: number;
  ef_construction: number;
  ef_search: number;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Batch operation options
 */
export interface DuckDBBatchOptions {
  /**
   * Number of vectors to process in each batch
   * @default 1000
   */
  batchSize?: number;

  /**
   * Enable parallel processing
   * @default true
   */
  parallel?: boolean;

  /**
   * Transaction mode
   * @default 'auto'
   */
  transactionMode?: 'auto' | 'manual' | 'none';

  /**
   * Progress callback
   */
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Parquet import options
 */
export interface ParquetImportOptions {
  /**
   * Path to Parquet file or S3 URL
   */
  source: string;

  /**
   * Column mapping
   */
  mapping?: {
    id?: string;
    vector?: string;
    content?: string;
    metadata?: string;
  };

  /**
   * Batch size for import
   * @default 10000
   */
  batchSize?: number;
}
