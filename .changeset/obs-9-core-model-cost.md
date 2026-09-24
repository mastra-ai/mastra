---
'@mastra/core': minor
---

Added a `modelCost` trace field to advanced trace queries. Filter with the numeric operators, order with `orderBy: [{ field: 'modelCost', direction: 'desc' }]`, and read the value from `tableSummary.modelCost` when requesting `include: { tableSummary: true }`. The cost is the complete USD cost of every model call in the trace, computed from the model-usage metrics before pagination, so a page never ranks a partial figure. Traces with a missing price, a partial cost, a non-USD unit, or an invalid value report `null` instead of `0`, satisfy `notExists`, and sort after every priced trace in both directions.

```typescript
queryTraces({
  timeRange,
  where: { op: 'gt', left: { path: 'modelCost' }, right: { literal: 1 } },
  orderBy: [{ field: 'modelCost', direction: 'desc' }],
  include: { tableSummary: true },
})
// traces[0].tableSummary.modelCost → 1.42
```
