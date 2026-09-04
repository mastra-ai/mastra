---
'@mastra/duckdb': minor
---

Added DuckDB support for filtering traces by related feedback.

```typescript
await mastraClient.queryTraces({
  timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-08T00:00:00.000Z' },
  where: { feedback: { some: { op: 'eq', left: { path: 'feedbackType' }, right: { literal: 'rating' } } } },
})
```
