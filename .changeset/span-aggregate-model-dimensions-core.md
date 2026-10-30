---
'@mastra/core': minor
---

Span aggregates can now group by `model` and `provider` and count their distinct values with `countDistinct.model` and `countDistinct.provider`. Stores opt in with the new `span-aggregate-model-dimensions` feature.

```typescript
const { rows } = await mastraClient.aggregateSpans({
  timeRange,
  where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'model_generation' } },
  groupBy: ['provider', 'model'],
  measures: ['count', 'tokens.total.sum', 'cost.sum'],
});
```
