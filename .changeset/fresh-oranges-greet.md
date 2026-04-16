---
'@mastra/langfuse': patch
---

Improved Langfuse trace batching for streamed runs by adding `flushAt` and `flushInterval` controls.

Added an `includeModelChunks` option so you can suppress high-volume `MODEL_CHUNK` spans when constructing `LangfuseExporter`. The default remains unchanged for backward compatibility.
