---
'@mastra/hono': patch
---

Fix MCP Streamable HTTP client disconnects crashing the server with `ERR_INVALID_STATE`

When an MCP Streamable HTTP client dropped its session, nothing informed the simulated Node
response behind the `fetch-to-node` bridge, so the MCP transport kept its SSE keep-alive timer
armed. A later keep-alive tick wrote into an already-closed stream controller, and because that
write originates in a timer callback the resulting `ERR_INVALID_STATE` was unhandled and took
down the process roughly 15 seconds after the disconnect.

Client disconnects are now propagated to the simulated Node response, which aborts the transport
and lets it tear the stream down and clear its keep-alive timer.
