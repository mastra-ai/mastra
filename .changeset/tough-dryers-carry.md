---
'@mastra/clickhouse': minor
---

Added ClickHouse support for richer score predicates in advanced trace queries.

```ts
where: { scores: { some: { op: "gte", left: { path: "timestamp" }, right: { literal: "2026-08-01T00:00:00.000Z" } } } }
```
