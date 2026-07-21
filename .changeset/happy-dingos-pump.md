---
'@mastra/mcp': patch
---

Fixed MCP clients getting permanently stuck after a failed reconnect to a streamable-HTTP-only server. A stale transport left attached to the underlying MCP SDK client is now detached before every connect attempt, so `listTools()`, `callTool()`, and `forceReconnect()` recover as soon as the server is reachable again instead of failing forever with "Already connected to a transport" or silently returning an empty toolset. Fixes https://github.com/mastra-ai/mastra/issues/19862
