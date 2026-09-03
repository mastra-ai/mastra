---
'@mastra/duckdb': minor
---

Added DuckDB support for richer score predicates in advanced trace queries.

```ts
where: { scores: { some: { op: "eq", left: { path: "scoreSource" }, right: { literal: "automated" } } } }
```
