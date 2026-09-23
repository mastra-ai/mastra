---
'@mastra/duckdb': minor
---

Added trace-query tag predicates for DuckDB. Trace queries can use `includes`, `notIncludes`, `exists`, and `notExists` on `tags`, and value discovery returns each observed tag with the number of traces that carry it. Missing and empty tag lists behave the same. Span tags are now trimmed, deduplicated, and stripped of blank entries on write, matching the PostgreSQL and ClickHouse stores.

**Example**

```ts
const observability = await duckdbStore.getStore('observability');
const result = await observability.queryTraces(
  planTraceQuery(
    parseTraceQueryRequest({
      timeRange: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-21T00:00:00.000Z' },
      where: { op: 'exists', path: 'tags' },
    }),
  ),
);
```
