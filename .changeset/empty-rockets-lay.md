---
'@mastra/core': minor
'@mastra/client-js': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
'@mastra/pg': minor
'@mastra/spanner': minor
---

Added batch trace ID filtering to observability metric queries.

```ts
const result = await observability.getMetricBreakdown({
  name: ['mastra_model_total_input_tokens'],
  aggregation: 'sum',
  groupBy: ['traceId'],
  filters: { traceIds: ['trace-1', 'trace-2'] },
});
```
