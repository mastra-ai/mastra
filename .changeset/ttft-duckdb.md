---
'@mastra/duckdb': minor
---

DuckDB trace, span and thread queries now return and filter by `timeToFirstTokenMs`, and trace and span queries can sort by it, slowest or fastest first. Traces use the root span's value. Traces and spans without a value come last.

```typescript
orderBy: [{ field: 'timeToFirstTokenMs', direction: 'desc' }]
```
