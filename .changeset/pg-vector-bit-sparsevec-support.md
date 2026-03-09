---
"@mastra/pg": minor
---

Add support for pgvector's `bit` and `sparsevec` vector storage types

You can now store binary and sparse vectors in `@mastra/pg`:

```ts
// Binary vectors for fast similarity search
await db.createIndex({
  indexName: 'my_binary_index',
  dimension: 128,
  metric: 'hamming', // or 'jaccard'
  vectorType: 'bit',
});

// Sparse vectors for BM25/TF-IDF representations
await db.createIndex({
  indexName: 'my_sparse_index',
  dimension: 500,
  metric: 'cosine',
  vectorType: 'sparsevec',
});
```

What's new:
- `vectorType: 'bit'` for binary vectors with `'hamming'` and `'jaccard'` distance metrics
- `vectorType: 'sparsevec'` for sparse vectors (cosine, euclidean, dotproduct)
- Automatic metric normalization: `bit` defaults to `'hamming'` when no metric is specified
- `includeVector` round-trips work correctly for all vector types
- Requires pgvector >= 0.7.0
