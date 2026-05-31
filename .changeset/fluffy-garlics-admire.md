---
'@mastra/mcp': patch
---

Close the stale MCP transport before reconnecting so SSE connections no longer leak orphaned EventSource instances and accumulate server-side sessions on implicit reconnect.
