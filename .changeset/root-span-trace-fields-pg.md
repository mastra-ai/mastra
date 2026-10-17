---
'@mastra/pg': patch
---

Added support for grouping and filtering by the root span's `name` and `spanType` in the PostgreSQL observability store. `aggregateTraces()` can group by both and count their distinct values, and `queryTraces()`, `aggregateTraces()`, and trace-query value discovery can filter on or suggest them. Values come from each trace's current completed root span.

```ts
await mastraClient.aggregateTraces({ timeRange, groupBy: ['spanType', 'name'], measures: ['count'] });
```
