---
'@mastra/observability': minor
'@mastra/laminar': patch
'@mastra/core': patch
---

Added `MODEL_INFERENCE` spans inside `MODEL_STEP`. The tracker now re-parents `MODEL_CHUNK` spans under `MODEL_INFERENCE`, so `MODEL_STEP` duration covers processors and tool execution while `MODEL_INFERENCE` covers only the provider call. Token usage and finish reason are still duplicated onto `MODEL_STEP` so existing integrations that read those fields are unchanged.
