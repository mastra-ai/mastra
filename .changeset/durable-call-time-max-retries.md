---
'@mastra/core': patch
---

Durable and evented agents now honor call-time `modelSettings.maxRetries`. Previously the durable llm-execution step's retry ladder only read retry counts from serialized model-list entries (hardcoding 0 for single-model agents), so a `maxRetries` passed via `stream()`/`generate()` model settings was silently ignored and failed requests were never retried. The agent-level retry config now rides on the serialized workflow options, and the ladder applies the same precedence as the in-process loop: an explicitly configured agent-level `maxRetries` (including 0) wins, otherwise the call-time `modelSettings.maxRetries` applies.
