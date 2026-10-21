---
'@mastra/duckdb': minor
---

DuckDB trace and span queries can now sort by `timeToFirstChunkMs`, slowest or fastest first. Traces and spans without a value come last.

```typescript
orderBy: [{ field: 'timeToFirstChunkMs', direction: 'desc' }]
```
