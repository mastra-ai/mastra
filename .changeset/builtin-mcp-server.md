---
'@mastra/server': minor
---

Added a built-in MCP server. MCP clients such as Claude Code, Cursor, and the MCP Inspector can now call your agents, workflows, and tools at `/api/mcp` without defining an `MCPServer`. Every call goes through the matching HTTP route, so validation, auth, RBAC, FGA, and thread or run ownership apply exactly as they do over the HTTP API.

The endpoint is served under `mastra dev`, and in production only when `server.auth` is configured. It accepts only `Authorization: Bearer` credentials. Connecting needs the new `mcp:read` permission, and seeing or calling tools needs `mcp:execute`.

```bash
claude mcp add --transport http mastra http://localhost:4111/api/mcp
```

Configure it with `server.mcp`:

```ts
export const mastra = new Mastra({
  server: {
    mcp: {
      featured: { agents: ['support-agent'] },
      exclude: { tools: ['delete-account'] },
    },
  },
});
```

See the [built-in MCP server docs](https://mastra.ai/docs/server/mcp).
