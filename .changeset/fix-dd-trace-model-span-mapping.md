---
'@mastra/datadog': patch
---

Fix Datadog LLM Observability span kind mapping for model spans.

`MODEL_STEP` (the actual single LLM API call) is now mapped to Datadog's `llm` kind, and `MODEL_GENERATION` (the wrapper around 1..N steps + tool/reasoning events) is mapped to `workflow`. This restores the expected "Model Calls" count in Datadog (one per API call instead of one per generation) and produces a structured `{role, content}` message array on each step span instead of stringifying the wrapper.

Token usage metrics are now reported only on `MODEL_STEP` spans to avoid double-counting cost across the parent `MODEL_GENERATION` and its child steps. `MODEL_STEP` LLM spans inherit `modelName` / `modelProvider` from their parent `MODEL_GENERATION` so the model is still attached in Datadog.
