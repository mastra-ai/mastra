---
'@mastra/react': minor
---

Added `useTraceQueryDiscoveryAvailable`, which reports whether the observability store supports both trace queries and field discovery. `useTraceMetadataFilterFields` now also returns `canonicalFields`, the store's built-in trace fields with their supported operators.
