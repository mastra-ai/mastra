---
'@mastra/duckdb': minor
---

Added time to first chunk to DuckDB trace and span queries. `queryTraces()` returns the root span's `timeToFirstChunkMs` and `querySpans()` returns each span's, or `null` when no chunk was streamed. Both accept `timeToFirstChunkMs` filters.

```typescript
where: { op: 'gt', left: { path: 'timeToFirstChunkMs' }, right: { literal: 2000 } }
```
