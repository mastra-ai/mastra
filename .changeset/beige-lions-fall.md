---
'@mastra/core': minor
---

Added trace filters for span names, model providers, timing, outcomes, identity, and version lineage.

```ts
await mastraClient.queryTraces({
  timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-08T00:00:00.000Z' },
  where: { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: 'medication_lookup' } } } },
})
```
