---
'@mastra/datadog': minor
---

Mapped `MODEL_INFERENCE` spans to Datadog's `llm` kind (with token usage and model/provider attached) and `MODEL_STEP` to `workflow`. Falls back to the previous mapping when paired with an older `@mastra/core` that does not emit `MODEL_INFERENCE`.
