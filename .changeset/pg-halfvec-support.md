---
'@mastra/pg': patch
---

Add halfvec type support for large dimension embeddings

Adds `vectorType` option to `createIndex()` for choosing between full precision (`vector`) and half precision (`halfvec`) storage. halfvec uses 2 bytes per dimension instead of 4, enabling indexes on embeddings up to 4000 dimensions.

```typescript
await pgVector.createIndex({
  indexName: 'large-embeddings',
  dimension: 3072, // text-embedding-3-large
  metric: 'cosine',
  vectorType: 'halfvec',
});
```

Requires pgvector >= 0.7.0 for halfvec support. Docker compose files updated to use pgvector 0.8.0.
