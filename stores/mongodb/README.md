# @mastra/mongodb

MongoDB Atlas Search implementation for Mastra, providing vector similarity search and index management using MongoDB Atlas Local or Atlas Cloud.

## Installation

```bash
npm install @mastra/mongodb
```

## Usage

### Vector Store

```typescript
import { MongoDBVector } from '@mastra/mongodb';

const vectorDB = new MongoDBVector({
  id: 'mongodb-vector',
  uri: 'mongodb://mongodb:mongodb@localhost:27018/?authSource=admin&directConnection=true',
  dbName: 'vector_db',
});

// Connect to MongoDB
await vectorDB.connect();

// Create a new vector index (collection)
await vectorDB.createIndex({
  indexName: 'my_vectors',
  dimension: 3,
  metric: 'cosine', // or 'euclidean', 'dotproduct'
});

// Upsert vectors
const ids = await vectorDB.upsert({
  indexName: 'my_vectors',
  vectors: [
    [0.1, 0.2, 0.3],
    [0.3, 0.4, 0.5],
  ],
  metadata: [{ text: 'doc1' }, { text: 'doc2' }],
});

// Query vectors
const results = await vectorDB.query({
  indexName: 'my_vectors',
  queryVector: [0.1, 0.2, 0.3],
  topK: 10,
  filter: { text: 'doc1' },
  includeVector: false,
});

// Clean up
await vectorDB.disconnect();
```

## Documentation

- [MongoDB integration guide](https://mastra.ai/integrations/databases/mongodb)
- [MongoDB vector reference](https://mastra.ai/reference/vectors/mongodb)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/mongodb/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
