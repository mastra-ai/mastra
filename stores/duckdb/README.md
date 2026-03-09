# @mastra/duckdb

DuckDB vector store implementation for Mastra, providing high-performance embedded vector similarity search with HNSW indexing. No external server required - runs entirely in-process.

## Installation

```bash
npm install @mastra/duckdb
```

## Usage

### Vector Store

```typescript
import { DuckDBVector } from '@mastra/duckdb';

// Create a vector store with in-memory database
const vectorStore = new DuckDBVector({
  id: 'my-vector-store',
  path: ':memory:', // or './vectors.duckdb' for persistence
});

// Create a new index with vector support
await vectorStore.createIndex({
  indexName: 'my_vectors',
  dimension: 1536,
  metric: 'cosine',
});

// Add vectors with metadata
const ids = await vectorStore.upsert({
  indexName: 'my_vectors',
  vectors: [
    [0.1, 0.2, 0.3],
    [0.3, 0.4, 0.5],
  ], // truncated - use actual 1536-dim vectors
  metadata: [
    { text: 'doc1', category: 'A' },
    { text: 'doc2', category: 'B' },
  ],
});

// Query similar vectors
const results = await vectorStore.query({
  indexName: 'my_vectors',
  queryVector: [0.1, 0.2, 0.3], // truncated - use actual 1536-dim vector
  topK: 10,
  filter: { category: 'A' },
  includeVector: false,
});

// Clean up
await vectorStore.close();
```

### With RAG Pipeline

```typescript
import { Mastra } from '@mastra/core';
import { DuckDBVector } from '@mastra/duckdb';

const vectorStore = new DuckDBVector({
  id: 'rag-store',
  path: './rag-vectors.duckdb',
});

// Use with Mastra's RAG system
const mastra = new Mastra({
  vectors: {
    ragStore: vectorStore,
  },
});
```

## Configuration

### Constructor Options

| Option       | Type                                      | Default      | Description                                               |
| ------------ | ----------------------------------------- | ------------ | --------------------------------------------------------- |
| `id`         | `string`                                  | required     | Unique identifier for the vector store instance           |
| `path`       | `string`                                  | `':memory:'` | Database file path. Use `:memory:` for in-memory database |
| `dimensions` | `number`                                  | `1536`       | Default dimension for vector embeddings                   |
| `metric`     | `'cosine' \| 'euclidean' \| 'dotproduct'` | `'cosine'`   | Default distance metric for similarity search             |

### Example Configurations

```typescript
// In-memory (fast, non-persistent)
const memoryStore = new DuckDBVector({
  id: 'memory-store',
  path: ':memory:',
});

// File-based (persistent)
const fileStore = new DuckDBVector({
  id: 'file-store',
  path: './data/vectors.duckdb',
  dimensions: 768,
  metric: 'cosine',
});

// With euclidean distance
const euclideanStore = new DuckDBVector({
  id: 'euclidean-store',
  path: ':memory:',
  metric: 'euclidean',
});
```

## Features

### Vector Store Features

- Embedded database with no external server required
- HNSW indexing for fast approximate nearest neighbor search
- Vector similarity search with cosine, euclidean, and dot product metrics
- Advanced metadata filtering with MongoDB-like query syntax
- Automatic UUID generation for vectors
- File-based persistence or in-memory operation
- Table management (create, list, describe, delete)

### Key Benefits

- **Zero infrastructure** - No database server to manage
- **High performance** - HNSW indexing with configurable parameters
- **SQL interface** - Familiar query language for metadata filtering
- **Parquet support** - Native import/export capabilities
- **Low memory footprint** - Efficient resource usage

## Supported Filter Operators

The following filter operators are supported for metadata queries:

- Comparison: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`
- Logical: `$and`, `$or`, `$not`, `$nor`
- Array: `$in`, `$nin`
- Element: `$exists`
- Text: `$contains`

### Filter Examples

```typescript
// Simple equality
const results = await vectorStore.query({
  indexName: 'docs',
  queryVector: [0.1, 0.2, 0.3], // truncated - use actual embedding vector
  filter: { category: 'technology' },
});

// Comparison operators
const results = await vectorStore.query({
  indexName: 'docs',
  queryVector: [0.1, 0.2, 0.3], // truncated - use actual embedding vector
  filter: { price: { $gt: 100, $lte: 500 } },
});

// Logical operators
const results = await vectorStore.query({
  indexName: 'docs',
  queryVector: [0.1, 0.2, 0.3], // truncated - use actual embedding vector
  filter: {
    $and: [{ category: 'electronics' }, { $or: [{ brand: 'Apple' }, { brand: 'Samsung' }] }],
  },
});

// Array operators
const results = await vectorStore.query({
  indexName: 'docs',
  queryVector: [0.1, 0.2, 0.3], // truncated - use actual embedding vector
  filter: { tags: { $in: ['featured', 'sale'] } },
});

// Nested field access
const results = await vectorStore.query({
  indexName: 'docs',
  queryVector: [0.1, 0.2, 0.3], // truncated - use actual embedding vector
  filter: { 'user.profile.tier': 'premium' },
});
```

## Vector Store Methods

### Index Management

- `createIndex({ indexName, dimension, metric? })`: Create a new table with vector support and optional HNSW index
- `listIndexes()`: List all vector-enabled tables
- `describeIndex({ indexName })`: Get table statistics (dimension, count, metric)
- `deleteIndex({ indexName })`: Delete a table and its data

### Vector Operations

- `upsert({ indexName, vectors, metadata?, ids? })`: Add or update vectors
- `query({ indexName, queryVector, topK?, filter?, includeVector? })`: Search for similar vectors
- `updateVector({ indexName, id?, filter?, update })`: Update a vector by ID or metadata filter
- `deleteVector({ indexName, id })`: Delete a single vector by ID
- `deleteVectors({ indexName, ids?, filter? })`: Delete multiple vectors by IDs or metadata filter

### Connection Management

- `close()`: Close the database connection

## Distance Metrics

| Metric       | Description       | Score Range         | Best For                            |
| ------------ | ----------------- | ------------------- | ----------------------------------- |
| `cosine`     | Cosine similarity | 0-1 (1 = identical) | Text embeddings, normalized vectors |
| `euclidean`  | L2 distance       | 0-∞ (0 = identical) | Image embeddings, spatial data      |
| `dotproduct` | Inner product     | -∞ to ∞             | When magnitude matters              |

## Use Cases

### Embedded Semantic Search

Build offline-capable AI applications with semantic search that runs entirely in-process without external dependencies.

```typescript
const vectorStore = new DuckDBVector({
  id: 'semantic-search',
  path: './search.duckdb',
});
```

### Local RAG Pipelines

Process sensitive documents locally without sending data to cloud vector databases.

```typescript
const vectorStore = new DuckDBVector({
  id: 'local-rag',
  path: './private-docs.duckdb',
  dimensions: 1536, // OpenAI embeddings
});
```

### Development and Testing

Rapidly prototype vector search features with zero infrastructure setup.

```typescript
const vectorStore = new DuckDBVector({
  id: 'dev-store',
  path: ':memory:', // Fast in-memory for testing
});
```

## Related Links

- [DuckDB Documentation](https://duckdb.org/docs/)
- [DuckDB VSS Extension](https://duckdb.org/docs/extensions/vss)
- [Mastra Documentation](https://mastra.ai/docs)
- [GitHub Issue #8140](https://github.com/mastra-ai/mastra/issues/8140)
