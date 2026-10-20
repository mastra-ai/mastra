---
'@mastra/server': minor
'@mastra/client-js': patch
---

Trace queries, trace aggregates, and thread queries now return a 422 when they use the root span's `name` or `spanType` and the configured observability store does not support them, instead of failing with a 500. For those stores, trace-query field discovery also omits both fields from its field list and `aggregate.dimensions`. A new `traceQueryRootSpanFields` capability reports whether the store supports them.

```ts
const { capabilities } = await mastraClient.getObservabilityCapabilities();
if (capabilities.traceQueryRootSpanFields) {
  await mastraClient.aggregateTraces({ timeRange, groupBy: ['name'], measures: ['count'] });
}
```
