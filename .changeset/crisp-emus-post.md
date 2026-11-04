---
'@mastra/mcp': patch
---

Fixed MCP tool calls running twice on the server after a dropped connection. When the connection fails after a call was sent, the server may already have run it, so the call now fails with `MCP_CLIENT_TOOL_CALL_OUTCOME_UNKNOWN` instead of being sent again. A dropped connection on one call also no longer aborts and resends other calls running on the same server. Calls that never reached the server, such as a refused connection, are still retried after reconnecting. Fixes #28415.
