# @mastra/qdrant

Vector store implementation for Qdrant using the official @qdrant/js-client-rest SDK with added telemetry support.

## Installation

```bash
pnpm add @mastra/qdrant
```

## Usage

```typescript
import { QdrantVector } from '@mastra/qdrant';

const vectorStore = new QdrantVector(
  'http://localhost:6333', // url
  'optional-api-key',      // optional
  false                    // https (optional)
);

// Create a new collection
await vectorStore.createIndex({ indexName: 'my-collection', dimension: 1536, metric: 'cosine' });

// Add vectors
const vectors = [[0.1, 0.2, ...], [0.3, 0.4, ...]];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert({ indexName: 'my-collection', vectors, metadata });

// Query vectors
const results = await vectorStore.query({
  indexName: 'my-collection',
  queryVector: [0.1, 0.2, ...],
  topK: 10, // topK
  filter: { text: { $eq: 'doc1' } }, // optional filter
  includeVector: false // includeVector
});
```

## Configuration

Required:

- `url`: URL of your Qdrant instance

Optional:

- `apiKey`: API key for authentication
- `https`: Whether to use HTTPS (default: false)

## Features

- Vector similarity search with Cosine, Euclidean, and Dot Product metrics
- Automatic batching for large upserts (256 vectors per batch)
- Built-in telemetry support
- Metadata filtering
- Optional vector inclusion in query results
- Automatic UUID generation for vectors
- Support for both local and cloud deployments
- Built on top of @qdrant/js-client-rest SDK

## Distance Metrics

The following distance metrics are supported:

- `cosine` → Cosine distance
- `euclidean` → Euclidean distance
- `dotproduct` → Dot product

## Methods

- `createIndex({ indexName, dimension, metric? })`: Create a new collection
- `upsert({ indexName, vectors, metadata?, ids? })`: Add or update vectors
- `query({ indexName, queryVector, topK?, filter?, includeVector? })`: Search for similar vectors
- `listIndexes()`: List all collections
- `describeIndex(indexName)`: Get collection statistics
- `deleteIndex(indexName)`: Delete a collection

## Related Links

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Qdrant REST API Reference](https://qdrant.github.io/qdrant/redoc/index.html)
