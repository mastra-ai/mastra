# @mastra/duckdb

DuckDB vector database provider for Mastra - embedded vector search with VSS extension.

## Features

- 🚀 **Embedded Database**: Zero network latency, runs in-process
- 🔍 **HNSW Indexing**: Fast approximate nearest neighbor search
- 📊 **Multiple Metrics**: Cosine similarity, Euclidean distance, Dot product
- 🔄 **Hybrid Search**: Combine vector similarity with full-text search
- 📦 **Parquet Support**: Direct import from Parquet files (S3/local)
- 🎯 **Rich Filtering**: Complex metadata queries with JSON paths
- 💾 **Persistent or In-Memory**: Choose between file-based or memory storage
- 🔧 **Production Ready**: Connection pooling, transactions, error handling

## Installation

```bash
# Using npm
npm install @mastra/duckdb

# Using pnpm
pnpm add @mastra/duckdb

# Using yarn
yarn add @mastra/duckdb
```

## Quick Start

```typescript
import { DuckDBVector } from '@mastra/duckdb';

// Initialize the vector store
const vectorStore = new DuckDBVector({
  path: ':memory:', // or '/path/to/database.duckdb'
  dimensions: 512,
  metric: 'cosine',
});

// Create an index
await vectorStore.createIndex({
  indexName: 'my-index',
  dimension: 512,
  metric: 'cosine',
});

// Upsert vectors
await vectorStore.upsert({
  indexName: 'my-index',
  vectors: [
    [...], // 512-dimensional vector
  ],
  metadata: [
    {
      content: 'Hello world',
      category: 'greeting',
    },
  ],
  ids: ['doc1'],
});

// Query similar vectors
const results = await vectorStore.query({
  indexName: 'my-index',
  queryVector: [...], // 512-dimensional query vector
  topK: 10,
  filter: {
    metadata: {
      category: 'greeting',
    },
  },
});
```

## Configuration

### Basic Configuration

```typescript
const vectorStore = new DuckDBVector({
  // Database path - use ':memory:' for in-memory
  path: '/path/to/database.duckdb',

  // Default vector dimensions
  dimensions: 512,

  // Similarity metric: 'cosine', 'euclidean', or 'dot'
  metric: 'cosine',

  // Connection pool size
  poolSize: 5,

  // Memory limit for DuckDB
  memoryLimit: '2GB',

  // Number of threads
  threads: 4,

  // Read-only mode
  readOnly: false,

  // Custom extensions to load
  extensions: ['vss'], // VSS is loaded by default
});
```

### Index Configuration

```typescript
await vectorStore.createIndex({
  name: 'my-index',
  dimension: 512,
  metric: 'cosine', // or 'euclidean', 'dot'
});
```

## Core Operations

### Upserting Vectors

```typescript
// Single vector
await vectorStore.upsert({
  indexName: 'my-index',
  vectors: [
    {
      id: 'unique-id',
      values: [0.1, 0.2, ...], // Must match index dimension
      metadata: {
        // Any JSON-serializable metadata
        title: 'Document Title',
        tags: ['ai', 'ml'],
        score: 0.95,
      },
    },
  ],
});

// Batch upsert with namespace
await vectorStore.upsert({
  indexName: 'my-index',
  vectors: vectors, // Array of vectors
  namespace: 'production', // Optional namespace
});
```

### Querying Vectors

```typescript
// Basic similarity search
const results = await vectorStore.query({
  indexName: 'my-index',
  queryVector: [...], // Query vector
  topK: 10,
});

// With metadata filtering
const filtered = await vectorStore.query({
  indexName: 'my-index',
  queryVector: [...],
  topK: 10,
  filter: {
    metadata: {
      category: { $in: ['tech', 'science'] },
      score: { $gte: 0.8 },
    },
  },
  includeMetadata: true,
  includeVectors: false,
});
```

### Advanced Filtering

```typescript
// Complex filter with logical operators
const results = await vectorStore.query({
  indexName: 'my-index',
  queryVector: [...],
  topK: 20,
  filter: {
    $and: [
      { metadata: { status: 'published' } },
      {
        $or: [
          { metadata: { category: 'tech' } },
          { metadata: { tags: { $contains: 'ai' } } },
        ],
      },
      { metadata: { score: { $between: [0.7, 1.0] } } },
    ],
  },
});
```

### Supported Filter Operators

- `$eq`: Equal to
- `$ne`: Not equal to
- `$gt`, `$gte`: Greater than (or equal)
- `$lt`, `$lte`: Less than (or equal)
- `$in`, `$nin`: In/Not in array
- `$like`, `$ilike`: Pattern matching
- `$regex`: Regular expression
- `$exists`: Field exists check
- `$between`: Range query
- `$contains`, `$containsAny`, `$containsAll`: Array operations

### Hybrid Search

Combine vector similarity with full-text search:

```typescript
const results = await vectorStore.hybridSearch(
  'my-index',
  queryVector,
  'search terms', // Text query
  {
    vectorWeight: 0.7, // 70% vector, 30% text
    topK: 10,
    filter: {
      metadata: { status: 'active' },
    },
  },
);
```

### Managing Vectors

```typescript
// Update vector metadata
await vectorStore.updateVector({
  indexName: 'my-index',
  id: 'doc1',
  metadata: {
    lastUpdated: new Date().toISOString(),
    version: 2,
  },
});

// Delete vectors
await vectorStore.deleteVector({
  indexName: 'my-index',
  id: ['doc1', 'doc2', 'doc3'], // Single ID or array
});
```

### Index Management

```typescript
// List all indexes
const indexes = await vectorStore.listIndexes();

// Get index statistics
const stats = await vectorStore.describeIndex({
  indexName: 'my-index',
});
console.log(stats);
// {
//   dimension: 512,
//   count: 10000,
//   metric: 'cosine',
//   status: 'ready'
// }

// Delete an index
await vectorStore.deleteIndex({
  indexName: 'my-index',
});
```

## Advanced Features

### Parquet Import

Import vectors directly from Parquet files:

```typescript
// From local file
await vectorStore.importFromParquet('my-index', {
  source: '/path/to/embeddings.parquet',
  mapping: {
    id: 'document_id',
    vector: 'embedding',
    content: 'text',
    metadata: 'metadata',
  },
  batchSize: 10000,
});

// Note: If you need to filter Parquet data, please pre-filter your files
// or use a staging table approach, as runtime filtering is not supported.

// From S3
await vectorStore.importFromParquet('my-index', {
  source: 's3://bucket/path/embeddings.parquet',
  mapping: {
    id: 'id',
    vector: 'ollama_embedding',
    metadata: 'doc_metadata',
  },
});
```

### Connection Pooling

The provider automatically manages a connection pool for optimal performance:

```typescript
const vectorStore = new DuckDBVector({
  poolSize: 10, // Number of connections in pool
  // Connections are automatically managed
});

// Manual cleanup when done
await vectorStore.close();
```

### Performance Optimization

```typescript
// Batch operations for better performance
const vectors = generateLargeVectorSet(); // 10000+ vectors

// Chunk and insert
const chunkSize = 1000;
for (let i = 0; i < vectors.length; i += chunkSize) {
  await vectorStore.upsert({
    indexName: 'my-index',
    vectors: vectors.slice(i, i + chunkSize),
  });
}
```

## Integration with Mastra

### Using with Mastra RAG

```typescript
import { Mastra } from '@mastra/core';
import { DuckDBVector } from '@mastra/duckdb';

const mastra = new Mastra({
  vectors: {
    provider: new DuckDBVector({
      path: './embeddings.duckdb',
      dimensions: 512,
    }),
  },
});

// Use in RAG pipeline
const rag = mastra.rag({
  model: 'ollama:llama2',
  vectorStore: 'duckdb',
});
```

### Deposium MCP Integration

Perfect for Deposium's multi-space document management:

```typescript
// Configure for Deposium
const vectorStore = new DuckDBVector({
  path: './deposium.duckdb',
  dimensions: 512, // Ollama embeddings
  metric: 'cosine',
});

// Create space-specific index
await vectorStore.createIndex({
  name: 'deposium-docs',
  dimension: 512,
  metric: 'cosine',
});

// Query specific space
const results = await vectorStore.query({
  indexName: 'deposium-docs',
  queryVector: ollamaEmbedding,
  filter: {
    metadata: {
      space_id: { $in: ['space1', 'space2'] },
      document_type: 'markdown',
    },
  },
});
```

## Testing

```bash
# Run tests (DuckDB runs embedded, no setup required)
pnpm test

# Run specific tests
pnpm test duckdb-vector.test.ts

# Run with coverage
pnpm test --coverage
```

## Benchmarks

Performance on MacBook Pro M1 with 16GB RAM:

| Operation       | Vectors | Time  | Throughput |
| --------------- | ------- | ----- | ---------- |
| Insert          | 1,000   | ~0.5s | 2,000/s    |
| Insert          | 10,000  | ~4s   | 2,500/s    |
| Insert          | 100,000 | ~35s  | 2,857/s    |
| Query (top-10)  | 100,000 | ~15ms | 66 qps     |
| Query (top-100) | 100,000 | ~25ms | 40 qps     |
| Filtered Query  | 100,000 | ~30ms | 33 qps     |

## Comparison with Other Stores

| Feature        | DuckDB      | PostgreSQL   | Pinecone    | Chroma      |
| -------------- | ----------- | ------------ | ----------- | ----------- |
| Deployment     | Embedded    | Self-hosted  | Cloud       | Embedded    |
| Latency        | Zero        | Low          | Network     | Zero        |
| Scalability    | Single-node | Multi-node   | Infinite    | Single-node |
| Cost           | Free        | Server costs | Usage-based | Free        |
| Persistence    | Yes         | Yes          | Yes         | Yes         |
| Hybrid Search  | Yes         | Yes          | No          | Limited     |
| Parquet Import | Native      | Via COPY     | No          | No          |

## Troubleshooting

### Common Issues

1. **VSS Extension Not Found**

   ```typescript
   // The extension is installed automatically when creating the store
   const vectorStore = new DuckDBVector({
     extensions: ['vss'], // Ensure VSS is in extensions list
   });
   ```

2. **Memory Issues with Large Datasets**

   ```typescript
   const vectorStore = new DuckDBVector({
     memoryLimit: '8GB', // Increase memory limit
     threads: 8, // Use more threads
   });
   ```

3. **Slow Queries**
   - Ensure HNSW index is created
   - Adjust `ef_search` parameter for speed/accuracy trade-off
   - Use filtering to reduce search space

## Migration Guide

### From PostgreSQL (pgvector)

```typescript
// PostgreSQL
const pg = new PostgreSQLVector({ connectionString: '...' });

// DuckDB (similar API)
const duckdb = new DuckDBVector({ path: './vectors.duckdb' });

// Migration script
const data = await pg.query({ indexName: 'old-index', topK: 1000000 });
await duckdb.upsert({ indexName: 'new-index', vectors: data });
```

### From Pinecone

```typescript
// Export from Pinecone
const vectors = await pinecone.fetch({ ids: [...] });

// Import to DuckDB
await duckdb.upsert({
  indexName: 'my-index',
  vectors: vectors.map(v => ({
    id: v.id,
    values: v.values,
    metadata: v.metadata,
  })),
});
```

## Contributing

See the main [Mastra contributing guide](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md).

## License

Apache 2.0 - see [LICENSE](LICENSE) for details.

## Links

- [Mastra Documentation](https://mastra.ai/docs)
- [DuckDB VSS Extension](https://duckdb.org/docs/extensions/vss)
- [GitHub Repository](https://github.com/mastra-ai/mastra)
- [npm Package](https://www.npmjs.com/package/@mastra/duckdb)
