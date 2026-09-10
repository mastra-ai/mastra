---
'@mastra/duckdb': minor
---

Added configurable age-based pruning for DuckDB observability spans, metrics, logs, scores, and feedback.

**Before**

DuckDB observability data was retained until it was deleted explicitly.

**After**

```typescript
const storage = new DuckDBStore({
  path: 'mastra.duckdb',
  retention: {
    observability: {
      spans: { maxAge: '30d' },
      logs: { maxAge: '7d' },
    },
  },
})

await storage.prune()
```
