---
'@mastra/core': patch
---

Fixed processor-provided `modelSettings` being overwritten by conflicting per-model settings or explicit retry configuration. Fixes https://github.com/mastra-ai/mastra/issues/22395

Settings returned by `processInputStep` (or `prepareStep`) were merged under the model list's per-model settings at the point of model invocation, so any key both of them set was decided by the model entry rather than the processor. `maxRetries` was affected on single-model agents too, not just fallback chains, because any agent-level `maxRetries` triggered the same override. Per-model resolution now happens once before processors run, so a processor-supplied value wins, and the MODEL_INFERENCE span reports the settings the model actually received.

A processor returning a partial `modelSettings` (for example just `{ temperature }`) still keeps the resolved `maxRetries` and `timeout` — a partial return does not drop them.
