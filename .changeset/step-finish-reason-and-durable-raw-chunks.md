---
'@mastra/core': patch
---

Fixed two gaps in agent stream results:

- Steps passed to `prepareStep` and kept on the run state now report the step's `finishReason` (for example `'tool-calls'`). It was `undefined` on the regular agent loop.
- Durable and evented agents now emit raw provider chunks when `includeRawChunks: true` is set, both on `fullStream` and to `onChunk`. They were dropped before.
