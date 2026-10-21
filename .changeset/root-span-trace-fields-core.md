---
'@mastra/core': minor
---

Added the root span's `name` and `spanType` as trace-scope fields for trace queries and trace aggregates.

- `parseTraceQueryRequest()` and `parseTraceAggregateRequest()` accept `name` and `spanType` in trace-scope `where` predicates.
- `planTraceAggregate()` accepts them in `groupBy` and as `countDistinct.name` / `countDistinct.spanType`.
- Trace-scope field discovery lists both with value suggestions, and the `aggregate.dimensions` list includes them.

Inside `spans.some` and `spans.none`, `name` and `spanType` still match any span in the trace.

```ts
const plan = planTraceAggregate(
  parseTraceAggregateRequest({
    timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-08-08T00:00:00Z' },
    where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'workflow_run' } },
    groupBy: ['name'],
    measures: ['count', 'errorRate'],
  }),
);
```

Stores that support these fields declare the new `trace-query-root-span-fields` storage feature.
