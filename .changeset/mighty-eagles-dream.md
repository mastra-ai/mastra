---
'@mastra/mcp': minor
---

Added `MCPClient.getServerInfo()`, which returns the identity each connected MCP server announced when it connected: its name, version, and, when provided, title, description, website URL, and icons. Use it to show users which server they connected instead of only the URL they entered. Servers that have not connected yet return `undefined`. Fixes #24559.

```typescript
await mcp.listTools();

const info = mcp.getServerInfo();
console.log(info.myServer?.title, info.myServer?.version, info.myServer?.icons);
```
