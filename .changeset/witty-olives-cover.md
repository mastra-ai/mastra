---
'@mastra/mcp': patch
---

Fixed `MCPServer` answering a call to an unknown tool with an `isError: true` tool result. The call now fails with a JSON-RPC `-32602` (Invalid params) error, as the MCP specification requires, so clients can tell a missing tool apart from a tool that ran and failed. Fixes #29139.

If your client checked `isError` to detect a missing tool, catch the rejected `callTool()` instead. This includes `MCPClient` with `onToolError: 'return'`, where calling a tool the server no longer serves now throws.
