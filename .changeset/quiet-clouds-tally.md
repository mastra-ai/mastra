---
'@mastra/clickhouse': patch
---

Added token and cost measures to `aggregateTraces()` in the ClickHouse observability store.

- **Token measures:** `tokens.input`, `tokens.output`, `tokens.total`, `tokens.reasoning`, and `tokens.cached`, each as `.sum` or `.avg`.
- **Cost measures:** `cost.sum` and `cost.avg`. Rows for cost requests also include `cost: { coverage, unit }`.

```ts
const plan = planTraceAggregate(
  parseTraceAggregateRequest({
    timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
    groupBy: ['entityName'],
    measures: ['tokens.total.sum', 'cost.sum'],
  }),
);
const { rows } = await observability.aggregateTraces(plan);
// rows[0] → { dimensions: { entityName: 'support' }, measures: { 'tokens.total.sum': 7800, 'cost.sum': 3.75 }, cost: { coverage: 0.75, unit: 'usd' } }
```

Usage comes from the model token metrics of each trace. Retried metric writes count once without waiting for background merges, and spend recorded after the window ends still counts for traces that started inside it.
