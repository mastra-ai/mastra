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
  keyspace: 'your-keyspace', // optional
});

// Create a new collection
await vectorStore.createIndex({ indexName: 'myCollection', dimension: 3, metric: 'cosine' });

// Add vectors
const vectors = [
  [0.1, 0.2, 0.3],
  [0.3, 0.4, 0.5],
];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert({ indexName: 'myCollection', vectors, metadata });

// Query vectors
const results = await vectorStore.query({
  indexName: 'myCollection',
  queryVector: [0.1, 0.2, 0.3],
  topK: 10, // topK
  filter: { text: { $eq: 'doc1' } }, // optional filter
  includeVector: false, // includeVectors
});
```

## Documentation

- [@mastra/astra documentation](https://mastra.ai/reference/vectors/astra)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/astra/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
