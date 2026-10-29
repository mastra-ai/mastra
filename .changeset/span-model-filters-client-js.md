---
'@mastra/client-js': patch
---

`getObservabilityCapabilities()` returns the `spanQueryModelFields` flag. When it's `true`, `querySpans()` and `aggregateSpans()` accept `model` and `provider` filters.
