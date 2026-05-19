---
'@mastra/mcp': patch
---

Close previous SSE transport before accepting a new connection in `MCPServer.connectSSE()`. Previously, sequential SSE connections to the same server would fail with "Already connected to a transport" because the underlying protocol was never closed when the previous client disconnected.
