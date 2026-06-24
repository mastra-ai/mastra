---
'@mastra/pg': patch
---

Fixed PgVector numeric range filters (`$gt`, `$gte`, `$lt`, `$lte`) failing the entire query when any row's metadata held a non-numeric value at the filtered path.

Because JSONB metadata is schemaless, a single document with a value like `{ price: 'N/A' }` made Postgres cast the whole column to `numeric` and raise `invalid input syntax for type numeric` (`22P02`), breaking all range-filtered vector queries (and semantic recall using `semanticRecall.filter`) on that index. Non-numeric values are now simply excluded from the result, matching the behavior of the other Mastra vector stores and MongoDB-style `$gt` semantics.

```typescript
await pgVector.upsert({
  indexName: 'products',
  vectors: [[1, 0], [0, 1]],
  metadata: [{ price: 100 }, { price: 'N/A' }],
});

// Before: threw "invalid input syntax for type numeric: N/A"
// After: returns only the row whose price is actually a number
await pgVector.query({
  indexName: 'products',
  queryVector: [1, 0],
  topK: 10,
  filter: { price: { $gt: 50 } },
});
```
