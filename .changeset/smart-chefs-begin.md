---
'@mastra/duckdb': minor
---

Added DuckDB support for parameterized top-level metadata predicates in advanced trace queries.

```ts
where: { op: "notExists", path: "metadata.parentMessageId" }
```
