---
'@mastra/posthog': patch
---

The `$ai_trace` event of a served MCP request now includes the caller's `callerTraceparent` and `callerTracestate`, so the trace keeps who called it.
