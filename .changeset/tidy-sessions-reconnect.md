---
'@mastra/mcp': patch
---

The MCP client now recovers from an expired Streamable HTTP session. A server that answers a request with `400`, `401`, `403` or `404` reports the status in structured error data (`SdkHttpError.status`, `data.status` or `statusCode`) rather than in the error message, so the client's reconnect check never matched it and every later tool call failed on the dead session until the process restarted. `isReconnectableMCPError` now reads the structured status first, so the client reconnects and retries once.
