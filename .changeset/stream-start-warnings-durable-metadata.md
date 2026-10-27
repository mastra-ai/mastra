---
'@mastra/core': patch
---

Provider warnings now reach `result.warnings` and each step's `warnings`. AI SDK v6 providers (OpenAI, Anthropic, Google) report unsupported settings such as `seed` on the stream's first part, which Mastra ignored, so warnings were always empty. A step's `warnings` is now always an array (empty when the provider reports none) instead of `undefined`.

Durable and evented agents now resolve `result.providerMetadata`, `result.response.headers` and `result.response.modelMetadata` like the regular agent; these were previously `undefined`. A failed model step on durable and evented agents now reports its warnings and model metadata too.
