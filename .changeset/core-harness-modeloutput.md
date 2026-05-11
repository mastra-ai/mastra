---
'@mastra/core': patch
---

Expose tool `toModelOutput` content on streaming `tool-result` chunks and harness `tool_end` events. The `modelOutput` (e.g. screenshot image parts produced by a tool's `toModelOutput`) is now available on `chunk.payload.providerMetadata.mastra.modelOutput` and forwarded to harness consumers via `tool_end.modelOutput` and `tool_result.modelOutput`, including in history replay. This lets harness UIs (such as the mastracode TUI) render rich tool output inline without re-running the tool.
