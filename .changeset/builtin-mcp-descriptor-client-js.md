---
'@mastra/client-js': minor
---

Added `getBuiltinMcpServer()` to read how the built-in MCP server is set up.

```ts
const server = await client.getBuiltinMcpServer();
if (server.enabled && server.mcpPackageInstalled) {
  console.log(`Connect MCP clients to ${server.path}`);
}
```
