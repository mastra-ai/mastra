---
'@mastra/server': minor
---

Added `spanQueryOutcomeFields` and `traceQueryOutcomeFields` to the observability capabilities response. Span and trace query, aggregate, and discovery routes return `501` when a request uses `outcome` or `stopReason` against a store that does not support them.

```ts
const { capabilities } = await client.getObservabilityCapabilities();
if (capabilities.spanQueryOutcomeFields) {
  // outcome and stopReason predicates, groupBy, and countDistinct are available on span routes
}
```
