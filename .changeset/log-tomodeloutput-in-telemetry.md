---
"@mastra/observability": patch
---

Tool results with `toModelOutput` now show the transformed content in both telemetry span output and trace previews. Previously, locally-executed tools always logged `undefined` as the span output and `[tool-result]` as the preview, making it impossible to see what was actually sent to the model. Now the span output reflects the `toModelOutput`-transformed value (via `providerMetadata.mastra.modelOutput`) when defined, falling back to the raw result otherwise.
