---
'@mastra/core': minor
---

Added a strict advanced trace-query contract, trusted planner, cursor binding, and storage capability.

```ts
const request = traceQueryRequestSchema.parse({
  timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
  where: { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
})
```
