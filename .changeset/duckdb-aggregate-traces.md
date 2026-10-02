---
'@mastra/duckdb': minor
---

Added `aggregateTraces()` support to the DuckDB observability store. The store now advertises the `trace-aggregate` capability and returns grouped counts, error rates, duration statistics, and time-bucketed series over the same traces that `queryTraces()` selects.

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

`queryTraces()`, `queryThreads()`, and trace-query discovery are also faster over large stores: the time range, tenant scope, and simple root filters such as `environment`, `entityName`, or `threadId` now narrow the scan before each trace's current root span is selected. Results are unchanged.
