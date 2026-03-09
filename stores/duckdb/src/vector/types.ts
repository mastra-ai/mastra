import type { VectorFilter } from '@mastra/core/vector/filter';

/**
 * Configuration options for DuckDBVector.
 */
export interface DuckDBVectorConfig {
  /**
   * Unique identifier for this vector store instance.
   */
  id: string;

  /**
   * Path to the DuckDB database file.
   * Use ':memory:' for an in-memory database.
   * @default ':memory:'
   */
  path?: string;

  /**
   * Default dimension for vector embeddings.
   * @default 1536
   */
  dimensions?: number;

  /**
   * Default distance metric for similarity search.
   * @default 'cosine'
   */
  metric?: 'cosine' | 'euclidean' | 'dotproduct';

  /**
   * Memory limit for DuckDB operations.
   * @example '512MB', '2GB'
   */
  memoryLimit?: string;

  /**
   * Number of threads for DuckDB operations.
   * @default Number of CPU cores
   */
  threads?: number;

  /**
   * Maximum number of connections in the pool.
   * @default 5
   */
  maxPoolSize?: number;
}

/**
 * HNSW index configuration options.
 */
export interface HNSWConfig {
  /**
   * Maximum number of connections per layer.
   * Higher values improve recall but increase memory usage.
   * @default 16
   */
  M?: number;

  /**
   * Size of the dynamic candidate list during construction.
   * Higher values improve quality but slow down indexing.
   * @default 200
   */
  efConstruction?: number;

  /**
   * Size of the dynamic candidate list during search.
   * Higher values improve recall but slow down queries.
   * @default 40
   */
  efSearch?: number;
}

/**
 * Filter type for DuckDB vector queries.
 * Supports MongoDB-style query operators.
 */
export type DuckDBVectorFilter = VectorFilter;

/**
 * Query options specific to DuckDB vector store.
 */
export interface DuckDBQueryOptions {
  /**
   * Maximum number of results to return.
   * @default 10
   */
  topK?: number;

  /**
   * Minimum similarity score threshold (0-1 for cosine).
   */
  minScore?: number;

  /**
   * Whether to include the vector in results.
   * @default false
   */
  includeVector?: boolean;

  /**
   * Text search query for hybrid search.
   */
  textQuery?: string;

  /**
   * Weight for vector similarity in hybrid search (0-1).
   * @default 0.7
   */
  vectorWeight?: number;
}

/**
 * Options for importing data from Parquet files.
 */
export interface ParquetImportOptions {
  /**
   * Column name containing the vector embeddings.
   * @default 'embedding'
   */
  vectorColumn?: string;

  /**
   * Column name containing the vector IDs.
   * @default 'id'
   */
  idColumn?: string;

  /**
   * Column names to include as metadata.
   * If not specified, all non-vector columns are included.
   */
  metadataColumns?: string[];
}
