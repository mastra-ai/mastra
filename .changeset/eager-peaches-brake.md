---
'@mastra/duckdb': minor
---

Added list-compatible page pagination for advanced trace queries in DuckDB storage.

```ts
const result = await client.queryTraces({
  timeRange,
  pagination: { page: 0, perPage: 25 },
});
```
