---
'@mastra/mcp': patch
---

Fixed MCP client reconnect decisions to read the HTTP status from structured SDK error metadata instead of the error message. A server that returned 400, 401, 403, or 404 without quoting the status in its response body was treated as a non-reconnectable failure, so the client gave up and dropped the connection instead of reconnecting once and retrying. The status now comes from `SdkHttpError.status` (or `statusCode`/`data.status`) and a JSON-RPC numeric `code` still blocks reconnection, so a 500 whose body quotes a 4xx no longer reconnects either. No change to retry counts, the unsent-request check, or `MCP_CLIENT_TOOL_CALL_OUTCOME_UNKNOWN` behavior.
