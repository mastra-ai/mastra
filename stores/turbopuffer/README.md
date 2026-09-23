# @mastra/turbopuffer

Vector store implementation for Turbopuffer, using the official @turbopuffer/turbopuffer SDK with added telemetry support.

## Installation

```bash
npm install @mastra/turbopuffer
```

## Usage

```typescript
import { TurbopufferVector } from '@mastra/turbopuffer';

const vectorStore = new TurbopufferVector({
  id: 'my-turbopuffer-vector',
  apiKey: 'your-api-key',
  baseUrl: 'https://gcp-us-central1.turbopuffer.com',
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

- [@mastra/turbopuffer documentation](https://mastra.ai/reference/vectors/turbopuffer)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/turbopuffer/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
