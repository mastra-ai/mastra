---
'@mastra/pg': minor
---

Added trace-query tag predicates for PostgreSQL. Trace queries can use `includes`, `notIncludes`, `exists`, and `notExists` on `tags`, and value discovery returns each observed tag with the number of traces that carry it. Tag membership uses the existing GIN index on `tags`.

**Example**

```ts
const observability = await pgStore.getStore('observability');
const result = await observability.queryTraces(
  planTraceQuery(
    parseTraceQueryRequest({
      timeRange: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-21T00:00:00.000Z' },
      where: { op: 'includes', path: 'tags', value: 'manual-review' },
    }),
  ),
);
```
