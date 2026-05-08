/**
 * @mastra/duckdb - DuckDB vector and observability storage provider for Mastra
 *
 * Provides embedded high-performance vector storage with HNSW indexing
 * and OLAP-based observability storage for metrics, traces, logs, scores, and feedback.
 * No external server required - runs in-process.
 */

export { DuckDBVector } from './vector/index';
export type { DuckDBVectorConfig, DuckDBVectorFilter } from './vector/types';
export { DuckDBConnection, DuckDBStore, ObservabilityStorageDuckDB } from './storage/index';
export type { DuckDBStorageConfig, DuckDBStoreConfig, ObservabilityDuckDBConfig } from './storage/index';
