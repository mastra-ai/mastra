---
'@mastra/client-js': patch
---

`getObservabilityCapabilities()` returns the `spanAggregateModelDimensions` flag. When it's `true`, `aggregateSpans()` accepts `model` and `provider` in `groupBy` and as `countDistinct.model` and `countDistinct.provider`.

```typescript
const { capabilities } = await mastraClient.getObservabilityCapabilities();

if (capabilities.spanAggregateModelDimensions) {
  const { rows } = await mastraClient.aggregateSpans({
    timeRange,
    groupBy: ['model'],
    measures: ['count'],
  });
}
```
