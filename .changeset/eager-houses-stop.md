---
'@mastra/duckdb': minor
---

Added DuckDB support for filtering traces by related feedback. Repeated writes for one `feedbackId` now retain the latest record for feedback predicates.

```typescript
await mastraClient.queryTraces({
  timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-08T00:00:00.000Z' },
  where: { feedback: { some: { op: 'eq', left: { path: 'feedbackType' }, right: { literal: 'rating' } } } },
});
```
