---
'@mastra/duckdb': minor
---

Add DuckDB vector store implementation

Adds DuckDB as a vector store provider for Mastra, enabling embedded high-performance vector storage without requiring an external server.

```typescript
import { DuckDBVector } from '@mastra/duckdb';

const vectorStore = new DuckDBVector({
  id: 'my-store',
  path: ':memory:', // or './vectors.duckdb' for persistence
});

await vectorStore.createIndex({
  indexName: 'docs',
  dimension: 1536,
  metric: 'cosine',
});

await vectorStore.upsert({
  indexName: 'docs',
  vectors: [[0.1, 0.2, ...]],
  metadata: [{ text: 'hello world' }],
});

const results = await vectorStore.query({
  indexName: 'docs',
  queryVector: [0.1, 0.2, ...],
  topK: 10,
  filter: { text: 'hello world' },
});
```

