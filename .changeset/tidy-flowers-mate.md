---
'@mastra/clickhouse': minor
---

Added ClickHouse support for filtering traces by related feedback. Durable per-feedback write versions make the last accepted write current before trace correlation, independently of caller timestamps. Existing version-0 rows retain latest-timestamp ordering until their first post-migration replacement.

```typescript
await mastraClient.queryTraces({
  timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-08T00:00:00.000Z' },
  where: { feedback: { some: { op: 'eq', left: { path: 'feedbackSource' }, right: { literal: 'clinician' } } } },
});
```
