---
'@mastra/core': minor
---

Added a strict, size-bounded advanced trace-query contract, trusted planner, cursor binding, portable replacement semantics, execution-timeout identity, and storage capability.

```ts
const request = traceQueryRequestSchema.parse({
  timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
  where: { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
})
```
