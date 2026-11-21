---
'@mastra/mcp': minor
---

Added the `appViewTools` option to `MCPServer`. Tools named in it act on app views a host already shows, so with `appsRequireClientSupport` they're listed and callable only for clients that render MCP Apps.

```ts
const server = new MCPServer({
  id: 'app-server',
  name: 'App Server',
  version: '1.0.0',
  tools: { showChart, updateChart },
  appsRequireClientSupport: true,
  appViewTools: ['updateChart'],
});
```
