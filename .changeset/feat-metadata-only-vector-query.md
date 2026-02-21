---
"@mastra/core": minor
"@mastra/pg": minor
---

Support metadata-only queries in vector stores by making `queryVector` optional in the `QueryVectorParams` interface.

`PgVector.query()` now supports querying by metadata filters alone without providing a query vector — useful when you need to retrieve records by metadata without performing similarity search. At least one of `queryVector` or `filter` must be provided.

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

Also fixes documentation where the `query()` parameter was incorrectly named `vector` instead of `queryVector`.
