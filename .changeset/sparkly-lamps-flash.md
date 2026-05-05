---
'@mastra/mcp': minor
'@mastra/core': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/editor': patch
'@mastra/server': patch
---

Added MCP Apps extension support (SEP-1865). MCPServer now accepts an `appResources` config to register interactive `ui://` HTML resources. MCPClient preserves full tool `_meta` (including `ui.resourceUri`) when converting MCP tools to Mastra tools. Both advertise the `io.modelcontextprotocol/ui` extension capability.

**Example — MCPServer with app resources:**

```typescript
const server = new MCPServer({
  name: 'my-server',
  tools: { myTool },
  appResources: {
    dashboard: {
      name: 'Dashboard',
      description: 'Interactive dashboard UI',
      html: '<html>...</html>',
    },
  },
});
```
