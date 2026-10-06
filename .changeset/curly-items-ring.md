---
'@mastra/duckdb': minor
---

Added filtered span queries to DuckDB observability storage with stable pagination, previews, and model cost.

```typescript
const result = await observabilityStorage.querySpans(plan);
```
