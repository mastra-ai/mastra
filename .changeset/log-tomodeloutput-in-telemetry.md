---
"@mastra/observability": patch
---

Tool results with `toModelOutput` now show the transformed content in both telemetry span output and trace previews. Previously, locally-executed tools always logged `undefined` as the span output and `[tool-result]` as the preview, making it impossible to see what was actually sent to the model. Now the span output reflects the actual value sent to the model when a tool defines `toModelOutput`, falling back to the raw result otherwise.
