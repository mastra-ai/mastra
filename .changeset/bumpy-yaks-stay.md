---
'@mastra/core': minor
---

Added `requestId`, `serviceName`, and `experimentId` filters to advanced trace queries. Use them at trace scope or inside `spans.some` / `spans.none` with `eq`, `ne`, `in`, `notIn`, `exists`, and `notExists`.

```ts
const result = await observability.queryTraces(
  planTraceQuery(
    parseTraceQueryRequest({
      timeRange,
      where: {
        op: 'and',
        args: [
          { op: 'eq', left: { path: 'requestId' }, right: { literal: 'req-42' } },
          { spans: { some: { op: 'eq', left: { path: 'serviceName' }, right: { literal: 'payments' } } } },
        ],
      },
    }),
  ),
);
```
