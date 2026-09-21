---
'@mastra/client-js': minor
---

Added page-based pagination for advanced trace queries. Paginated responses include `pagination` metadata with `total`, `page`, `perPage`, and `hasMore`.

```ts
const result = await client.queryTraces({
  timeRange,
  pagination: { page: 0, perPage: 25 },
});
```
