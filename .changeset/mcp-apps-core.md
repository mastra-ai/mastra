---
'@mastra/core': minor
---

Added the `apps` and `studioUrl` options to `ServerMCPConfig` (`server.mcp`), for the built-in MCP server's MCP Apps. `apps: false` turns them off, and `studioUrl` sets where their **Open in Studio** button points.

```ts
export const mastra = new Mastra({
  server: {
    mcp: {
      apps: true,
      studioUrl: 'https://studio.example.com',
    },
  },
});
```
