---
'@mastra/clickhouse': minor
---

Added `aggregateTraces()` support to the ClickHouse observability store. The store now advertises the `trace-aggregate` capability. It returns grouped counts, error rates, duration statistics, and time-bucketed series over the same traces that `queryTraces()` selects. Retried and replaced trace roots are collapsed when the query runs, so results stay correct before background merges finish.

```ts
const plan = planTraceAggregate(
  parseTraceAggregateRequest({
    timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-08-08T00:00:00Z' },
    groupBy: ['entityName'],
    interval: '1d',
    measures: ['count', 'errorRate'],
  }),
);
const { rows, truncated } = await observability.aggregateTraces(plan);
```

`queryTraces()` and `aggregateTraces()` on ClickHouse are also faster for filters on trace fields such as `entityName`, `status`, or `metadata.*`. These filters now narrow the traces read before duplicate and replaced roots are collapsed, so selective queries over long time ranges do less work. Results are unchanged.
