---
'@mastra/clickhouse': minor
---

Added `timeToFirstChunkMs` to ClickHouse trace and span queries. `queryTraces()` returns the root span's time to first chunk and `querySpans()` returns each span's, both `null` when no chunk was streamed. You can also filter on it:

```typescript
where: { op: 'gt', left: { path: 'timeToFirstChunkMs' }, right: { literal: 1000 } }
```
