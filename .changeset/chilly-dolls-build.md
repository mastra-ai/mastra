---
'@mastra/mcp': minor
---

Expose tool `mcp.annotations` and `mcp._meta` in MCPServer listTools response

MCP clients (including OpenAI Apps SDK) now receive tool behavior hints and custom metadata when listing tools. This enables clients to display user-friendly tool titles, show permission indicators, and access arbitrary metadata without additional configuration.

```typescript
// Tools with mcp properties are automatically exposed via MCP
const server = new MCPServer({
  name: 'My Server',
  version: '1.0.0',
  tools: { myTool }, // mcp.annotations and mcp._meta flow through to clients
});
```
