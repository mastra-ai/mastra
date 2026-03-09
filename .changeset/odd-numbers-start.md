---
'@mastra/pg': minor
---

Added `metadataIndexes` option to `createIndex()` for PgVector. This allows creating btree indexes on specific metadata fields in vector tables, significantly improving query performance when filtering by those fields. This is especially impactful for Memory's `memory_messages` table, which filters by `thread_id` and `resource_id` — previously causing sequential scans under load.

**Usage example:**

```ts
await pgVector.createIndex({
  indexName: 'my_vectors',
  dimension: 1536,
  metadataIndexes: ['thread_id', 'resource_id'],
});
```

Fixes #12109
