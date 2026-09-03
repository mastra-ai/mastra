---
'@mastra/duckdb': minor
---

Added DuckDB support for strictly typed feedback values and related feedback trace predicates.

```typescript
where: { feedback: { some: { op: "eq", left: { path: "value" }, right: { literal: 3 } } } }
```
