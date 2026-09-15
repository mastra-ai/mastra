---
'@mastra/server': minor
---

Added list-compatible page pagination to the advanced trace query route.

```ts
const result = await client.queryTraces({
  timeRange,
  pagination: { page: 0, perPage: 25 },
});
```
