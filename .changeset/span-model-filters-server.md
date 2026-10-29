---
'@mastra/server': minor
---

Span query and span aggregate routes accept `model` and `provider` filters when the store supports them. `getObservabilityCapabilities()` reports support as `spanQueryModelFields`. Against an older store, these filters return `501` before storage runs.
