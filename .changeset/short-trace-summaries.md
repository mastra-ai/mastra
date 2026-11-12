---
'@mastra/server': minor
---

When an MCP Apps client such as Claude opens `query_traces`, `list_traces`, `get_trace`, or `list_logs` in a Studio app, the built-in MCP server now gives the model a compact text summary (one line per trace, span, or log) and sends the full rows to the app as `structuredContent`. Model context use for these tools drops by roughly 5–8x. Clients that don't render apps still receive the full JSON.
