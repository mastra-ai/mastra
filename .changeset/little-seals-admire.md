---
'@mastra/server': patch
---

MCP server and tool listings now report which transports a server offers (`streamable-http`, plus `sse` for MCP 1.x servers), so clients can tell MCP v2 servers apart without probing routes. Tool listings from MCP v2 servers keep the `id` Studio uses to execute them.
