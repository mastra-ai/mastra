/**
 * @mastra/duckdb - DuckDB vector and observability storage provider for Mastra
 *
 * Provides embedded high-performance vector storage with HNSW indexing
 * and OLAP-based observability storage for metrics, traces, logs, scores, and feedback.
 * No external server required - runs in-process.
 */

export { DuckDBVector } from './vector/index.js';
export type { DuckDBVectorConfig, DuckDBVectorFilter } from './vector/types.js';
export { DuckDBConnection, ObservabilityStorageDuckDB } from './storage/index.js';
export type { DuckDBStorageConfig, ObservabilityDuckDBConfig } from './storage/index.js';
