---
'@mastra/pg': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
---

Span aggregates can group by `model` and `provider`, and count distinct models and providers. Like the `model` and `provider` filters, grouping reads only the dedicated `model` and `provider` columns, not span attributes. Spans exported before `@mastra/observability` filled the columns group under `null`; existing spans aren't backfilled.

```typescript
const { rows } = await mastraClient.aggregateSpans({
  timeRange,
  where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'model_generation' } },
  groupBy: ['model'],
  measures: ['count', 'tokens.total.sum'],
});
// [{ dimensions: { model: 'claude-sonnet-5-5' }, measures: { count: 12, 'tokens.total.sum': 48210 } }, ...]
```
