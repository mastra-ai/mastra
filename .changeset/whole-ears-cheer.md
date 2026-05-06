---
'@mastra/core': minor
'@mastra/observability': patch
---

Added `MODEL_INFERENCE` span type for measuring pure model latency. The span wraps only the provider call (excluding input/output processors and tool executions) and lives between `MODEL_STEP` and `MODEL_CHUNK` in the trace hierarchy. Use it to surface the time spent by the model itself, separate from surrounding work in the same step.

Also exposes a `model-inference-span` entry in `coreFeatures` so dependent packages (notably `@mastra/observability`) can detect support and gracefully fall back when paired with an older `@mastra/core`.
