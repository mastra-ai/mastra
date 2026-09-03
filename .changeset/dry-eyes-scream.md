---
'@mastra/core': minor
---

Added the core contract for advanced trace queries, including bounded time ranges, recursive trace, span, and score predicates, thread grouping, and deterministic cursor pagination. Invalid or overly complex requests are rejected before a storage adapter executes them.

```ts
const request = traceQueryRequestSchema.parse({
  timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
  where: { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
});
```
