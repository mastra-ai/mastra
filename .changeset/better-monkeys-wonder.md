---
'@mastra/core': patch
---

Fixed cross-process durable agent observers to preserve configured output processors and scorer data. Durable stream `onChunk` callbacks are now delivered serially, and terminal callbacks wait for pending chunk delivery to finish.
