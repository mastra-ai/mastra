# @mastra/qdrant

Vector store implementation for Qdrant using the official @qdrant/js-client-rest SDK with added telemetry support.

## Installation

```bash
npm install @mastra/qdrant
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
  topK: 10,
  filter: { text: { $eq: 'doc1' } }, // optional filter
  includeVector: false,
});

// Query with named vectors (for collections with multiple vector fields)
const namedResults = await vectorStore.query({
  indexName: 'myCollection',
  queryVector: [0.1, 0.2, 0.3],
  topK: 10,
  using: 'title_embedding', // specify which named vector to query
});
```

## Documentation

- [@mastra/qdrant documentation](https://mastra.ai/reference/vectors/qdrant)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/qdrant/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
