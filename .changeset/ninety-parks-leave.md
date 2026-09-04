---
'@mastra/core': minor
---

Added feedback predicates to advanced trace queries.

```typescript
await mastraClient.queryTraces({
  timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-08T00:00:00.000Z' },
  where: { feedback: { some: { op: 'lt', left: { path: 'value' }, right: { literal: 0 } } } },
})
```
