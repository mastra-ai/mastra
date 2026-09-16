# @mastra/pinecone

Vector store implementation for Pinecone, using the official @pinecone-database/pinecone SDK with added telemetry support.

## Installation

```bash
npm install @mastra/pinecone
```

## Usage

```typescript
import { PineconeVector } from '@mastra/pinecone';

const vectorStore = new PineconeVector({
  id: 'my-pinecone',
  apiKey: 'your-api-key',
});

// Create a new index
await vectorStore.createIndex({ indexName: 'my-index', dimension: 3, metric: 'cosine' });

// Add vectors
const vectors = [
  [0.1, 0.2, 0.3],
  [0.3, 0.4, 0.5],
];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert({ indexName: 'my-index', vectors, metadata });

// Query vectors
const results = await vectorStore.query({
  indexName: 'my-index',
  queryVector: [0.1, 0.2, 0.3],
  topK: 10,
  filter: { text: { $eq: 'doc1' } },
  includeVector: false,
});
```

## Documentation

- [@mastra/pinecone documentation](https://mastra.ai/reference/vectors/pinecone)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/pinecone/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
