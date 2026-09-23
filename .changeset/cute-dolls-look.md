---
'@mastra/clickhouse': minor
---

Added trace-query tag predicates for ClickHouse. Trace queries can use `includes`, `notIncludes`, `exists`, and `notExists` on `tags`, and value discovery returns each observed tag with the number of traces that carry it. Missing and empty tag lists behave the same.

**Example**

```ts
const result = await clickhouseObservability.queryTraces(
  planTraceQuery(
    parseTraceQueryRequest({
      timeRange: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-21T00:00:00.000Z' },
      where: { op: 'notIncludes', path: 'tags', value: 'archived' },
    }),
  ),
);
```
