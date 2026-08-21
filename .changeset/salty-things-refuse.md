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
