---
'@mastra/memory': patch
---

Restore pre-refactor error contract for sync observation failures. **`ObservationStrategy.run()`** now **throws** on sync/resource-scoped observer errors after emitting failed markers, matching the monolith's `doSynchronousObservation` behavior. Async-buffer observation failures remain non-fatal (swallowed). This allows the processor's `try/catch` around `prepare()` to call `abort()` and trigger a TripWire, returning empty text instead of silently continuing with stale observations.

