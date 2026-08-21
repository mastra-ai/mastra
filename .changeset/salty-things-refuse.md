---
'@mastra/clickhouse': minor
'@mastra/pg': minor
---

Added support for filtering scores by metadata key-value pairs in listScores.

```typescript
const result = await storage.listScores({
  filters: { metadata: { env: 'prod' } },
});
```

Each top-level metadata key is matched with exact equality against the stored value. Nested objects and arrays compare structurally (key order doesn't matter) with no partial/subset matching, and an empty metadata filter is a no-op.
