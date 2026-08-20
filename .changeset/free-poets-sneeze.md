---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/libsql': minor
'@mastra/pg': minor
---

Added a unified score query and aggregation API. Scores can now be filtered by scorer, entity, trace, thread, source, date range, score range, and exact-match metadata key/value pairs, and aggregated (count, avg, p50, p95, pass rate) with UTC time bucketing and grouping by scorer, entity, or any metadata key. This enables segmented quality analytics — for example, tracking score trends per deployment, model version, or user cohort.

```typescript
const trend = await client.aggregateScores({
  bucket: 'day',
  groupBy: ['metadata:cohort'],
  startDate: '2026-08-01T00:00:00Z',
});
```
