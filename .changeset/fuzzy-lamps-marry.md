---
'@mastra/pg': minor
'@mastra/duckdb': minor
'@mastra/clickhouse': minor
---

Added portable nested string, number, and boolean metadata predicates and typed field/value discovery for trace queries. DuckDB, PostgreSQL, and ClickHouse now read exact scalar values from raw metadata, preserve empty and whitespace-only strings, and never traverse stored arrays.

```ts
await mastraClient.queryTraces({
  timeRange,
  where: { op: 'gte', left: { path: 'metadata.retry.count' }, right: { literal: 3 } },
})
```

**Breaking change**

Top-level `metadata.<key>` string predicates no longer trim stored values or treat empty strings as missing. Include whitespace in the query literal when it is part of the stored value.
