# @mastra/mongodb

Vector store implementation for MongoDB.

## Installation

```bash
npm install @mastra/mongodb
```

## Usage

```typescript
import { MongoDBStore } from '@mastra/mongodb';

const vectorStore = new MongoDBStore({

});

// Create a new index
await vectorStore.createIndex({
  indexName: 'my-index',
  dimension: 1536,
  metric: 'cosine'
});

// Add vectors
const vectors = [[0.1, 0.2, ...], [0.3, 0.4, ...]];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert({
  indexName: 'my-index',
  vectors,
  metadata
});

// Query vectors
const results = await vectorStore.query({
  indexName: 'my-index',
  queryVector: [0.1, 0.2, ...],
  topK: 10,
  filter: { text: { $eq: 'doc1' } },
  includeVector: false
});
```

## Configuration

COMING SOON

## Features

COMING SOON

## Methods

- `createIndex({ indexName, dimension, metric? })`: Create a new index
- `upsert({ indexName, vectors, metadata?, ids? })`: Add or update vectors
- `query({ indexName, queryVector, topK?, filter?, includeVector? })`: Search for similar vectors
- `deleteIndex(indexName)`: Delete an index

## Related Links

- [MongoDB Documentation](https://www.mongodb.com/docs)
