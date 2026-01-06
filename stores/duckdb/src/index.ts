/**
 * @mastra/duckdb - DuckDB vector store provider for Mastra
 *
 * Provides embedded high-performance vector storage with HNSW indexing.
 * No external server required - runs in-process.
 */

export { DuckDBVector } from './vector/index.js';
export type { DuckDBVectorConfig, DuckDBVectorFilter } from './vector/types.js';
