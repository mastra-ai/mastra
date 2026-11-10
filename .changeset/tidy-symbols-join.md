---
'@mastra/server': minor
'@mastra/core': minor
---

The built-in MCP server now opens `get_trace` results in an interactive trace viewer in clients that render MCP Apps, such as the Claude app. Install `@mastra/mcp-apps-components` to turn it on. Clients without MCP Apps support get the same tools and JSON results as before. Set `server.mcp.apps: false` to turn it off.

```bash
npm install @mastra/mcp-apps-components
```
