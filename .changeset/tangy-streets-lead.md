---
'@mastra/client-js': minor
---

Added `outcome` and `stopReason` filters and groupings to `querySpans()`, `aggregateSpans()`, `queryTraces()`, and `aggregateTraces()`, with `outcome`, `stopReason`, and `stopReasonContext` on results. Check `spanQueryOutcomeFields` and `traceQueryOutcomeFields` from `getObservabilityCapabilities()` first:

```ts
const { capabilities } = await client.getObservabilityCapabilities();
if (capabilities.spanQueryOutcomeFields) {
  await client.querySpans({ timeRange, where: { op: 'eq', left: { path: 'outcome' }, right: { literal: 'limit' } } });
}
```
