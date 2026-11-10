---
'@mastra/mcp': minor
---

Added `appsRequireClientSupport` to `MCPServer`. When enabled, MCP Apps are served only to clients that declare MCP Apps support; other clients see the server exactly as if it had no apps (no `ui://` resources, no app links on tools or results, and no app-only tools). This works for 2025-era clients over stateless HTTP too: a client that declares support at `initialize` gets an `Mcp-Session-Id` that carries the declaration on its later requests.

```ts
const server = new MCPServer({
  name: 'My server',
  version: '1.0.0',
  tools,
  appResources: { 'ui://my-app': myApp },
  appsRequireClientSupport: true,
});
```
