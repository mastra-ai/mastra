# @mastra/astra

Vector store implementation for DataStax Astra DB, providing vector similarity search capabilities using Cassandra's vector search functionality.

## Installation

```bash
npm install @mastra/astra
```

## Usage

```typescript
import { AstraVector } from '@mastra/astra';

const vectorStore = new AstraVector({
  token: 'your-astra-token',
  endpoint: 'your-astra-endpoint',
  keyspace: 'your-keyspace' // optional
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
  topK: 10, // topK
  filter: { text: { $eq: 'doc1' } }, // optional filter
  includeVector: false // includeVectors
});
```

## Configuration

The Astra DB vector store requires:

- `token`: Your Astra DB token
- `endpoint`: Your Astra DB endpoint
- `keyspace`: (Optional) The keyspace to use

## Features

- Vector similarity search with cosine, euclidean, and dot product metrics
- Metadata filtering support
- Batch vector upsert operations
- Collection management (create, list, describe, delete)
- Optional vector inclusion in query results
- Automatic UUID generation for vectors
- Built on top of @datastax/astra-db-ts client

## Methods

- `createIndex({ indexName, dimension, metric? })`: Create a new collection
- `upsert({ indexName, vectors, metadata?, ids })`: Add or update vectors
- `query({ indexName, queryVector, topK?, filter?, includeVector? })`: Search for similar vectors
- `listIndexes()`: List all collections
- `describeIndex(indexName)`: Get collection statistics
- `deleteIndex(indexName)`: Delete a collection

## Related Links

- [Astra DB Vector Search Documentation](https://docs.datastax.com/en/astra-db/docs/vector-search.html)
- [Astra DB API Reference](https://docs.datastax.com/en/astra-db-serverless/api-reference/documents.html)
