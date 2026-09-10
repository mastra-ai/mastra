---
'@mastra/pg': minor
---

Added PostgreSQL support for filtering traces by related feedback. Repeated writes for one `feedbackId`, including writes with the same timestamp and repeated IDs in one batch, now retain the last accepted record for feedback predicates.

```typescript
await mastraClient.queryTraces({
  timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-08T00:00:00.000Z' },
  where: { feedback: { none: { op: 'eq', left: { path: 'feedbackType' }, right: { literal: 'clinical-review' } } } },
});
```
