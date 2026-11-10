---
'@mastra/server': minor
---

In clients that render MCP Apps, such as the Claude app, the built-in MCP server now opens `query_traces` and `list_traces` results in Studio's trace explorer. Users can filter, sort, page, and switch between traces, spans, and threads, then open any trace on its timeline. The model's query stays applied until the user clears it. Install `@mastra/mcp-apps-components` to turn it on. Other clients get the same tools and JSON results as before.
