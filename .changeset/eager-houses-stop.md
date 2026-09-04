---
'@mastra/duckdb': minor
---

Added DuckDB support for filtering traces by related feedback.

```typescript
where: { feedback: { some: { op: "eq", left: { path: "feedbackType" }, right: { literal: "rating" } } } }
```
