---
'@mastra/core': patch
---

Fixed agent tool calls not being surfaced in evented workflow streams. Added StreamChunkWriter abstraction and stream format configuration ('legacy' | 'vnext') to forward agent stream chunks through the workflow output stream.
