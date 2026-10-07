---
'@mastra/mcp': minor
---

Added a `clientInfo` option to `MCPClient` so you can set the client name and version that MCP servers see during the handshake, instead of the server key and `1.0.0`. Set it once for all servers or override it per server. Tool name prefixes are unchanged. Fixes #25473.

```typescript
const mcp = new MCPClient({
  clientInfo: { name: 'my-app', version: '2.3.4' },
  servers: {
    weather: { url: new URL('http://localhost:8080/mcp') },
  },
});
```
