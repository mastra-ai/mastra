---
'@mastra/server': minor
---

In clients that render MCP Apps, such as the Claude app, the built-in MCP server now opens `list_logs` results on the trace explorer's Logs tab and `analyze_metrics` results on its Metrics tab, Studio's metrics dashboard. The model's filters stay applied until the user clears them. Each tab appears only when the store keeps that data and the caller can use the tools that read it.
