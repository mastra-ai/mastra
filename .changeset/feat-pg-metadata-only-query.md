---
"@mastra/pg": minor
---

`PgVector.query()` now supports querying by metadata filters alone without providing a query vector — useful when you need to retrieve records by metadata without performing similarity search.

**Before** (queryVector was required):
```ts
const results = await pgVector.query({
  indexName: 'my-index',
  queryVector: [0.1, 0.2, ...],
  filter: { category: 'docs' },
});
```

**After** (metadata-only query):
```ts
const results = await pgVector.query({
  indexName: 'my-index',
  filter: { category: 'docs' },
});
// Returns matching records with score: 0 (no similarity ranking)
```

At least one of `queryVector` or `filter` must be provided. When `queryVector` is omitted, results are returned with `score: 0` since no similarity computation is performed.
