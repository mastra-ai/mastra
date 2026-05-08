# @mastra/qdrant

Vector store implementation for Qdrant using the official @qdrant/js-client-rest SDK with added telemetry support.

## Installation

```bash
pnpm add @mastra/qdrant
```

## Usage

```typescript
import { QdrantVector } from '@mastra/qdrant';

const vectorStore = new QdrantVector({
  id: 'my-qdrant',
  url: 'http://localhost:6333',
  apiKey: 'optional-api-key', // optional
});

// Create a new collection
await vectorStore.createIndex({ indexName: 'myCollection', dimension: 1536, metric: 'cosine' });

// Add vectors
const vectors = [[0.1, 0.2, ...], [0.3, 0.4, ...]];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert({ indexName: 'myCollection', vectors, metadata });

// Query vectors
const results = await vectorStore.query({
  indexName: 'myCollection',
  queryVector: [0.1, 0.2, ...],
  topK: 10,
  filter: { text: { $eq: 'doc1' } }, // optional filter
  includeVector: false,
});

// Query with named vectors (for collections with multiple vector fields)
const namedResults = await vectorStore.query({
  indexName: 'myCollection',
  queryVector: [0.1, 0.2, ...],
  topK: 10,
  using: 'title_embedding', // specify which named vector to query
});
```

## Named Vectors

Qdrant supports [named vectors](https://qdrant.tech/documentation/concepts/vectors/#named-vectors), allowing multiple vector fields per collection. This is useful for multi-modal data (text + images) or different embedding models.

```typescript
// Create a collection with multiple named vector spaces
await vectorStore.createIndex({
  indexName: 'multi_modal',
  dimension: 768, // fallback
  namedVectors: {
    text: { size: 768, distance: 'cosine' },
    image: { size: 512, distance: 'euclidean' },
  },
});

// Upsert into specific vector spaces
await vectorStore.upsert({
  indexName: 'multi_modal',
  vectors: textEmbeddings,
  metadata: [{ type: 'text' }],
  vectorName: 'text', // target the text vector space
});

await vectorStore.upsert({
  indexName: 'multi_modal',
  vectors: imageEmbeddings,
  metadata: [{ type: 'image' }],
  vectorName: 'image', // target the image vector space
});

// Query specific vector spaces
const textResults = await vectorStore.query({
  indexName: 'multi_modal',
  queryVector: textQuery,
  using: 'text',
});

const imageResults = await vectorStore.query({
  indexName: 'multi_modal',
  queryVector: imageQuery,
  using: 'image',
});
```

## Configuration

Required:

- `id`: Unique identifier for this vector store instance
- `url`: URL of your Qdrant instance

Optional:

- `apiKey`: API key for authentication
- `https`: Whether to use HTTPS (default: false)

## Features

- Vector similarity search with Cosine, Euclidean, and Dot Product metrics
- [Named vectors](https://qdrant.tech/documentation/concepts/vectors/#named-vectors) support for collections with multiple vector fields
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

- `createIndex({ indexName, dimension, metric?, namedVectors? })`: Create a new collection (supports named vectors)
- `upsert({ indexName, vectors, metadata?, ids?, vectorName? })`: Add or update vectors (supports named vectors)
- `query({ indexName, queryVector, topK?, filter?, includeVector?, using? })`: Search for similar vectors
- `updateVector({ indexName, id?, filter?, update })`: Update a single vector by ID or metadata filter
- `deleteVector({ indexName, id })`: Delete a single vector by ID
- `deleteVectors({ indexName, ids?, filter? })`: Delete multiple vectors by IDs or metadata filter
- `createPayloadIndex({ indexName, fieldName, fieldSchema, wait? })`: Create a payload index for filtering
- `deletePayloadIndex({ indexName, fieldName, wait? })`: Delete a payload index
- `listIndexes()`: List all collections
- `describeIndex(indexName)`: Get collection statistics
- `deleteIndex(indexName)`: Delete a collection

## Related Links

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Qdrant REST API Reference](https://qdrant.github.io/qdrant/redoc/index.html)
