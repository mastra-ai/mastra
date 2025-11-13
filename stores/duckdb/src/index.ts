/**
 * @packageDocumentation
 * DuckDB vector database provider for Mastra - embedded vector search with VSS extension
 */

export { DuckDBVector } from './vector';
export type {
  DuckDBVectorConfig,
  DuckDBConnectionOptions,
  DuckDBIndexOptions,
  DuckDBQueryOptions,
} from './vector/types';

// Re-export commonly used types from core/vector
export type {
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  QueryResult,
  UpdateVectorParams,
  DeleteVectorParams,
  DeleteIndexParams,
  DescribeIndexParams,
  IndexStats,
} from '@mastra/core/vector';

/**
 * @example
 * ```typescript
 * import { DuckDBVector } from '@mastra/duckdb';
 *
 * const vectorStore = new DuckDBVector({
 *   path: ':memory:', // or '/path/to/database.duckdb'
 *   dimensions: 512,
 *   metric: 'cosine',
 * });
 *
 * // Create an index
 * await vectorStore.createIndex({
 *   name: 'my-index',
 *   dimension: 512,
 *   metric: 'cosine',
 * });
 *
 * // Upsert vectors
 * await vectorStore.upsert({
 *   indexName: 'my-index',
 *   vectors: [
 *     {
 *       id: 'doc1',
 *       values: [...], // 512-dimensional vector
 *       metadata: { content: 'Hello world' },
 *     },
 *   ],
 * });
 *
 * // Query similar vectors
 * const results = await vectorStore.query({
 *   indexName: 'my-index',
 *   queryVector: [...], // 512-dimensional query vector
 *   topK: 10,
 *   filter: { metadata: { space_id: 'space1' } },
 * });
 * ```
 */
