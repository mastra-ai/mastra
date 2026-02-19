---
'@mastra/core': patch
---

Fixed onChunk callback to receive raw Mastra chunks instead of AI SDK v5 converted chunks for tool results. Also added missing onChunk calls for tool-error chunks and tool-result chunks in mixed-error scenarios.
