---
'@mastra/mcp': minor
---

Added MCP Apps support for interactive UI rendering over MCP.

**MCPClientServerProxy** — a lightweight proxy that delegates resource and tool operations to remote MCP servers via `MCPClient`, enabling Studio to fetch app resources from any connected server.

**`toMCPServerProxies()`** — new convenience method on `MCPClient` that creates proxy objects for all configured servers, ready for Mastra-level registration.

**Automatic `serverId` stamping** — tools returned by `listTools()` now carry `_meta.ui.serverId`, allowing consumers to resolve `ui://` app resources from the correct MCP server in multi-server environments.

```ts
const mcp = new MCPClient({
  servers: {
    myApps: { url: new URL('https://my-mcp-server.example.com/mcp') },
  },
});

const mastra = new Mastra({
  agents: { myAgent },
  mcpServers: { ...mcp.toMCPServerProxies() },
});
```
