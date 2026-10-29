---
'@mastra/client-js': patch
---

`getObservabilityCapabilities()` returns the `spanQueryModelFields` flag. When it's `true`, `querySpans()` and `aggregateSpans()` accept `model` and `provider` filters.

```typescript
const { capabilities } = await mastraClient.getObservabilityCapabilities();

if (capabilities.spanQueryModelFields) {
  const { spans } = await mastraClient.querySpans({
    timeRange,
    where: { op: 'in', value: { path: 'model' }, set: ['gpt-5.6', 'claude-sonnet-5-5'] },
  });
}
```
