---
'@internal/llm-recorder': minor
---

Added recording file metadata (`RecordingMeta`) with test file, provider, model, and timestamps. Recording files now use `{ meta, recordings }` format (backward compatible with legacy array format).

Added `hosts`, `debug`, and `metaContext` options to `setupLLMRecording`. Exported `LLM_API_HOSTS` and `defaultNameGenerator`. Made `save()` idempotent.
