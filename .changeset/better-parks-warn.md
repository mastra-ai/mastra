---
'@mastra/server': minor
---

Added advanced trace-query support for richer same-span filters while keeping lightweight responses unchanged.

```ts
await mastraClient.queryTraces({
  timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-08T00:00:00.000Z' },
  where: { spans: { some: { op: 'exists', path: 'model' } } },
})
```
