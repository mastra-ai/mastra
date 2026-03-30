---
'@mastra/duckdb': minor
---

Added DuckDB-backed observability queries for score and feedback analytics, including aggregates like counts and averages, breakdowns by dimensions such as model or environment, time-series over fixed intervals, and percentile calculations like p50 and p95.

```ts
const result = await store.observability.getScorePercentiles({
  scorerId: 'relevance',
  percentiles: [0.5, 0.95],
  interval: '1h',
});
// { series: [{ percentile: 0.5, points: [{ timestamp, value }] }, ...] }
```
