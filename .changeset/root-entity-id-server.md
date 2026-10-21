---
'@mastra/server': minor
'@mastra/client-js': patch
---

Trace queries, trace aggregates, and thread queries now return a 422 when they use the root span's `entityId` at trace scope and the configured observability store does not support it, instead of failing with a 500. For those stores, trace-query field discovery also omits trace-scope `entityId` from its field list and `aggregate.dimensions`. A new `traceQueryRootEntityId` capability reports whether the store supports it. Span-scope `entityId` inside `spans.some` keeps working on every store.

```ts
const { capabilities } = await mastraClient.getObservabilityCapabilities();
if (capabilities.traceQueryRootEntityId) {
  await mastraClient.aggregateTraces({ timeRange, groupBy: ['entityId'], measures: ['count'] });
}
```
