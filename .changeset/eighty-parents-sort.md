---
'@mastra/datadog': patch
---

Fixed Datadog LLM Observability showing `model_name: custom` and missing model provider by correcting the span type mapping. `MODEL_GENERATION` now correctly maps to Datadog kind `llm` (was `workflow`), and `MODEL_STEP` falls back to `task` (was `llm`). This aligns with all other Mastra observability exporters and ensures Datadog receives model name, provider, and accurate cost estimation on the correct span. Fixes #14623.
