---
'@mastra/core': minor
---

Added public score and feedback analytics APIs to observability storage:
`getScoreAggregate` / `getFeedbackAggregate` for counts, sums, averages, minimums, maximums, or latest values;
`getScoreBreakdown` / `getFeedbackBreakdown` for grouped results by dimension;
`getScoreTimeSeries` / `getFeedbackTimeSeries` for time-bucketed trends;
and `getScorePercentiles` / `getFeedbackPercentiles` for percentile series such as p50 and p95.

```ts
await observability.getScoreTimeSeries({
  scorerId: 'relevance',
  interval: '1h',
  aggregation: 'avg',
});
// returns time-bucketed average scores
```
