# @mastra/vectorize

Vector store implementation for Vectorize, a managed vector database service optimized for AI applications.

## Installation

```bash
npm install @mastra/vectorize
```

## Usage

```typescript
import { CloudflareVector } from '@mastra/vectorize';

const vectorStore = new CloudflareVector({
  id: 'vectorize',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
});

// Create a new index
await vectorStore.createIndex({
  indexName: 'my-index',
  dimension: 3,
  metric: 'cosine',
});

// Add vectors
const vectors = [
  [0.1, 0.2, 0.3],
  [0.3, 0.4, 0.5],
];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert({
  indexName: 'my-index',
  vectors,
  metadata,
});

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

- [@mastra/vectorize documentation](https://mastra.ai/reference/vectors/vectorize)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/vectorize/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
