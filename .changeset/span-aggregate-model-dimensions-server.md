---
'@mastra/server': minor
---

The span aggregate route accepts `model` and `provider` in `groupBy` and `countDistinct` when the store supports them. `getObservabilityCapabilities()` reports support as `spanAggregateModelDimensions`. Against an older store, these requests return `501` before storage runs.

```typescript
const { capabilities } = await mastraClient.getObservabilityCapabilities();

if (capabilities.spanAggregateModelDimensions) {
  const { rows } = await mastraClient.aggregateSpans({
    timeRange,
    groupBy: ['rootEntityName'],
    measures: ['count', 'countDistinct.model'],
  });
}
```
