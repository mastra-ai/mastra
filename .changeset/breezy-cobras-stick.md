---
'@mastra/mongodb': minor
---

Added per-branch options and optional Atlas native reranking to `MongoDBVector.hybridQuery()`. Pass separate `vector` and `text` options to configure independent retrieval queries, candidate limits, fusion weights, and reranking fields. Existing `hybridQuery()` calls keep working unchanged.

Previously, applications called `hybridQuery()` and passed its results to a separately configured reranker. On a supporting Atlas deployment, retrieval and reranking can now run in one call without an application-side reranking client or separate Voyage API key:

```typescript
const results = await store.hybridQuery({
  indexName: 'articles',
  vector: { queryVector: embedding, limit: 50, numCandidates: 1000 },
  text: { query: question, paths: ['metadata.text'], limit: 50 },
  rerank: { query: question, paths: ['metadata.text'], numDocsToRerank: 50 },
  topK: 5,
});
```

Omit `rerank` for hybrid retrieval only, or use `vector.query` on an automatic-embedding index. Native reranking defaults to `rerank-2.5` and requires MongoDB 9.0+ on Atlas with Native Reranking enabled. The Preview `rerank-3` and `rerank-3-lite` models also need an M10-or-higher cluster.
