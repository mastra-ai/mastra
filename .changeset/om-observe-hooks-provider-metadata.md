---
"@mastra/memory": patch
---

Expose `providerMetadata` on Observational Memory `ObserveHooks` results

`onObservationEnd` and `onReflectionEnd` now receive an optional `providerMetadata` field alongside `usage`, carrying the OM model call's full provider metadata (for example AI Gateway cost and generation id under `providerMetadata.gateway`). This lets consumers capture per-call economics directly from the lifecycle hook instead of attaching a model-stream middleware to the observer/reflector models.

The field is additive and optional — existing hook consumers are unaffected, and it is simply absent when the provider emits no metadata. For batched resource-scoped observations and multi-attempt reflections it reflects the last batch/attempt that emitted provider metadata (`usage` is still summed; per-call provider metadata cannot be meaningfully merged).
