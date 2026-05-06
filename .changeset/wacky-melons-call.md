---
'@mastra/observability': minor
'@mastra/core': patch
---

Added `MODEL_INFERENCE` spans inside `MODEL_STEP`. The tracker now re-parents `MODEL_CHUNK` spans under `MODEL_INFERENCE`, so `MODEL_STEP` duration covers processors and tool execution while `MODEL_INFERENCE` covers only the provider call. Token usage and finish reason are still duplicated onto `MODEL_STEP` so existing integrations that read those fields are unchanged.

Gated on the `model-inference-span` flag in `coreFeatures`. When paired with an older `@mastra/core` that does not expose the flag, the tracker skips the new span and parents `MODEL_CHUNK` directly under `MODEL_STEP` (the pre-`MODEL_INFERENCE` behavior), so this version of `@mastra/observability` is safe to install against any supported `@mastra/core`.
