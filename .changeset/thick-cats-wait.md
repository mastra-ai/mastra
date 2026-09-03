---
'@mastra/clickhouse': minor
---

Added ClickHouse support for parameterized top-level metadata predicates in advanced trace queries.

```ts
where: { op: "exists", path: "metadata.protocolVersion" }
```
