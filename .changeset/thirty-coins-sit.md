---
'@mastra/core': minor
---

Added richer `scores.some` and `scores.none` predicates for scorer versions, sources, timestamps, span anchoring, and version lineage.

```ts
await mastraClient.queryTraces({
  timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-08T00:00:00.000Z' },
  where: { scores: { some: { op: 'eq', left: { path: 'scorerVersion' }, right: { literal: '2.1.0' } } } },
})
```
