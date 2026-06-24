---
'@mastra/pg': patch
---

Fixed PgVector numeric range filters (`$gt`, `$gte`, `$lt`, `$lte`) so rows with non-numeric metadata values no longer fail the whole query.

A single document with a value like `{ price: 'N/A' }` used to make the entire query error out, breaking all range-filtered vector queries (and semantic recall using `semanticRecall.filter`) on that index. Rows whose value isn't a number are now skipped for numeric range checks instead, matching the behavior of the other Mastra vector stores. Numeric rows still match as expected.

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
