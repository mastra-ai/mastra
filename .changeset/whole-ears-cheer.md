---
'@mastra/core': minor
'@mastra/observability': minor
---

Added new `MODEL_INFERENCE` span type under `MODEL_STEP`, covering only the model provider call. Use it to measure model latency separately from input/output processors and tool executions.
