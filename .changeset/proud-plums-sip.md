---
'@mastra/core': patch
---

Fixed `convertFullStreamChunkToUIMessageStream` from `@mastra/core/stream` dropping the finish reason. The terminal `finish` chunk now carries `finishReason`, so a UI message stream built on this export can tell `stop`, `length`, `content-filter`, `tool-calls` and `other` apart. Fixes #20562.
