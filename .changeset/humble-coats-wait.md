---
'@mastra/pg': minor
---

Added list-compatible page pagination for advanced trace queries in PostgreSQL storage.

```ts
const result = await client.queryTraces({
  timeRange,
  pagination: { page: 0, perPage: 25 },
});
```
