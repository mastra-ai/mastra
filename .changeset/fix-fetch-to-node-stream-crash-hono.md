---
'@mastra/hono': patch
---

Fixed a crash caused by the fetch-to-node library when a client disconnects mid-stream. The patched ReadableStream controller now handles cancellation gracefully, preventing errors when enqueuing or closing after disconnect.
