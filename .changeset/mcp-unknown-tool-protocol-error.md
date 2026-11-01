---
'@mastra/mcp': patch
---

`MCPServer` now rejects calls to unknown tools with a JSON-RPC `InvalidParams` (-32602) error, as the MCP specification requires, instead of returning a tool result with `isError: true`. Failures from a tool that actually ran are still returned as `isError: true` results.
