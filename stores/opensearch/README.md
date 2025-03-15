# @mastra/opensearch

Vector store implementation for OpenSearch using the official @opensearch-project/opensearch SDK

## Installation

```bash
pnpm add @mastra/opensearch
```

## Usage

```typescript
import { OpenSearchVector } from '@mastra/opensearch';

const vectorStore = new OpenSearchVector('http://localhost:9200');

// Create an index
await vectorStore.createIndex({ indexName: 'my-collection', dimension: 1536, metric: 'cosine' });

// Add vectors with documents
const vectors = [[0.1, 0.2, ...], [0.3, 0.4, ...]];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert({ indexName: 'my-collection', vectors, metadata });

// Query vectors with document filtering
const results = await vectorStore.query({
  indexName: 'my-collection',
  queryVector: [0.1, 0.2, ...],
  topK: 10, // topK
  filter: { text: { $eq: 'doc1' } }, // metadata filter
  includeVector: false, // includeVector
});
```

## Configuration

Required:

- `url`: URL of your OpenSearch instance

## Features

- Vector similarity search with Cosine, Euclidean, and Dot Product metrics
- Metadata filtering
- Optional vector inclusion in query results
- Automatic UUID generation for vectors
- Built on top of @opensearch-project/opensearch SDK

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

- [OpenSearch Documentation](https://opensearch.org/docs/latest/about/)
- [OpenSearch REST API Reference](https://opensearch.org/docs/latest/api-reference/)
