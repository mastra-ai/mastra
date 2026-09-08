# @mastra/elasticsearch

ElasticSearch vector store implementation for Mastra, providing vector similarity search and index management using ElasticSearch 8.x+.

## Installation

```bash
npm install @mastra/elasticsearch
```

## Usage

### Vector Store

```typescript
import { ElasticSearchVector } from '@mastra/elasticsearch';

const vectorDB = new ElasticSearchVector({
  url: 'http://localhost:9200',
  id: 'my-vector-store',
  auth: { apiKey: 'insert-api-key' },
});

// Create a new vector index
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

// Update vectors
await vectorDB.updateVector({
  indexName: 'my_vectors',
  id: 'vector-id',
  update: {
    vector: [0.5, 0.6, 0.7],
    metadata: { text: 'updated' },
  },
});

// Delete vectors
await vectorDB.deleteVector({
  indexName: 'my_vectors',
  id: 'vector-id',
});

// Bulk delete by filter
await vectorDB.deleteVectors({
  indexName: 'my_vectors',
  filter: { source: 'old-document.pdf' },
});
```

## Documentation

- [Elasticsearch integration guide](https://mastra.ai/integrations/databases/elasticsearch)
- [Elasticsearch vector reference](https://mastra.ai/reference/vectors/elasticsearch)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/elasticsearch/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
