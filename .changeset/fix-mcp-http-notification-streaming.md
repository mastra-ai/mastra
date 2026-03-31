---
'@mastra/hono': patch
---

fix(hono): stream MCP HTTP notifications incrementally instead of buffering

Do not await `server.startHTTP()` in the MCP HTTP transport handler so that
SSE notifications are streamed to the client as they are written, rather than
being buffered and delivered all at once when the final response completes.
