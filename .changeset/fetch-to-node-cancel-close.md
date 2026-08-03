---
'@mastra/hono': patch
---

Prevent MCP Streamable-HTTP disconnects from crashing the server 15s later by propagating ReadableStream cancellation into the fetch-to-node simulated Node response (and shipping the patched bridge inside @mastra/hono).
