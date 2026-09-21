---
'@mastra/core': minor
---

Added list-compatible page pagination to advanced trace queries while preserving keyset cursors.

```ts
const result = await client.queryTraces({
  timeRange,
  pagination: { page: 0, perPage: 25 },
});
```
