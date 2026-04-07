---
'@mastra/datadog': patch
---

Fix Datadog LLM Observability span kinds for model spans so traces match Datadog's expected shape.

- Each call to a model now shows up as an `llm` span in Datadog (previously the per-call spans were reported as `task`, so Datadog's "Model Calls" count was wrong and per-call inputs/outputs were not rendered as messages).
- The wrapper around a generation is now reported as a `workflow` span instead of `llm`, so it no longer looks like an extra LLM call.
- Token usage and cost are reported only on the per-call `llm` spans, so Datadog no longer double-counts tokens against the wrapper.
- Per-call `llm` spans inherit `modelName` and `modelProvider` from their parent generation, so the model is still attached in the Datadog UI.
