---
"@mastra/core": minor
---

Harness sessions can now list registered Model Context Protocol servers and inspect their available tools.

```ts
const servers = session.mcp.listServers();
const filesystem = session.mcp.getServer('filesystem');
const tools = await session.mcp.listTools('filesystem');
```

The catalog returns clone-safe snapshots of registered MCP server and tool descriptors. It is an integration inventory and does not imply tool execution permission.
