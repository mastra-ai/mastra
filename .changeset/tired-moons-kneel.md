---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
---

Added error handling for datastream-response stream processing. The read loop now catches reader.read() rejections and logs them with context instead of silently terminating the response. Also added a listener on the response stream for socket-level write errors (backpressure, connection resets), which cancels the reader gracefully.
