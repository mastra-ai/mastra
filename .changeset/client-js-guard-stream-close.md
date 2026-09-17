---
'@mastra/client-js': patch
---

Fixed an uncaught `ERR_INVALID_STATE` error when a consumer cancels an agent stream after its `finish` chunk.

Stream cancellation no longer produces an unhandled rejection.
