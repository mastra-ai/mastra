# @mastra/opensearch

The OpenSearchVector class provides vector search using OpenSearch, an open-source search and analytics engine.

## Installation

```bash
npm install @mastra/opensearch
```

## Usage

```typescript
import { OpenSearchVector } from '@mastra/opensearch';

const vectorStore = new OpenSearchVector('http://localhost:9200');

// Create an index
await vectorStore.createIndex({ indexName: 'my-collection', dimension: 3, metric: 'cosine' });

// Add vectors with documents
const vectors = [
  [0.1, 0.2, 0.3],
  [0.3, 0.4, 0.5],
];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert({ indexName: 'my-collection', vectors, metadata });

// Query vectors with document filtering
const results = await vectorStore.query({
  indexName: 'my-collection',
  queryVector: [0.1, 0.2, 0.3],
  topK: 10, // topK
  filter: { text: { $eq: 'doc1' } }, // metadata filter
  includeVector: false, // includeVector
});
```

## Documentation

- [Reference: OpenSearch vector store](https://mastra.ai/reference/vectors/opensearch)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/opensearch/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
