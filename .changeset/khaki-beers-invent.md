---
'@mastra/mcp': patch
---

Add "Not connected" error detection to MCP auto-reconnection

Enhanced the MCPClient auto-reconnection feature to also detect and handle "Not connected" protocol errors. When the MCP SDK's transport layer throws this error (typically when the connection is in a disconnected state), the client will now automatically reconnect and retry the operation.