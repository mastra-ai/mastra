---
'@mastra/pg': minor
---

Added `timeToFirstChunkMs` to PostgreSQL trace and span queries. `queryTraces()` returns the root span's time to first chunk and `querySpans()` returns each span's, both `null` when no chunk was streamed. You can filter on it like `durationMs`:

```typescript
where: { op: 'gt', left: { path: 'timeToFirstChunkMs' }, right: { literal: 2000 } }
```
