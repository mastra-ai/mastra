---
'@mastra/core': patch
---

Compute a tool's `toModelOutput` before emitting the streaming `tool-result` chunk so its value is available on `chunk.payload.providerMetadata.mastra.modelOutput`. Forward `providerMetadata` through the harness `tool_end` event and on `tool_result` content (both for streaming and history replay) so harness UIs can read `providerMetadata.mastra.modelOutput` (or any other provider metadata) without re-running the tool.
