---
'@mastra/client-js': minor
---

Added list-compatible page pagination types for advanced trace queries.

```ts
const result = await client.queryTraces({
  timeRange,
  pagination: { page: 0, perPage: 25 },
});
```
