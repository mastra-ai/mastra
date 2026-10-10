---
'@mastra/posthog': patch
---

The `$ai_trace` event of a served MCP request now includes `callerTraceparent` and `callerTracestate`, so you can see which trace called the MCP server.
