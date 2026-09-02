# @mastra/libsql

SQLite implementation for Mastra, providing both vector similarity search and general storage capabilities with connection pooling and transaction support.

## Installation

```bash
npm install @mastra/libsql
```

## Usage

### Vector Store

```typescript
import { LibSQLVector } from '@mastra/libsql';

const vectorStore = new LibSQLVector({
  url: 'file:./my-db.db',
});

// Create a new table with vector support
await vectorStore.createIndex({
  indexName: 'my_vectors',
  dimension: 3,
  metric: 'cosine',
});

// Add vectors
const ids = await vectorStore.upsert({
  indexName: 'my_vectors',
  vectors: [
    [0.1, 0.2, 0.3],
    [0.3, 0.4, 0.5],
  ],
  metadata: [{ text: 'doc1' }, { text: 'doc2' }],
});

// Query vectors
const results = await vectorStore.query({
  indexName: 'my_vectors',
  queryVector: [0.1, 0.2, 0.3],
  topK: 10, // topK
  filter: { text: 'doc1' }, // filter
  includeVector: false, // includeVector
  minScore: 0.5, // minScore
});
```

## Documentation

- [@mastra/libsql documentation](https://mastra.ai/reference/vectors/libsql)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/libsql/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
