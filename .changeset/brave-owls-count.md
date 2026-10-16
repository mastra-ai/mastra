---
'@mastra/core': minor
'@mastra/client-js': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
'@mastra/pg': minor
'@mastra/spanner': minor
---

Added batch experiment ID filtering to observability metric queries, so you can get token usage and cost for many experiments in one request.

```ts
const result = await client.getMetricBreakdown({
  name: ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'],
  aggregation: 'sum',
  groupBy: ['experimentId', 'name'],
  filters: { experimentIds: ['experiment-1', 'experiment-2'] },
});
```
