---
'@mastra/server': minor
---

Added a built-in MCP server. MCP clients such as Claude Code, Cursor, and the MCP Inspector can now call your agents, workflows, and tools at `/api/mcp` without defining an `MCPServer`. Every call goes through the matching HTTP route, so validation, auth, RBAC, FGA, and thread or run ownership apply exactly as they do over the HTTP API.

The built-in server needs `@mastra/mcp`, which is an optional peer dependency of `@mastra/server`. Install it to enable the endpoint:

```bash
npm install @mastra/mcp
```

Without it, everything else keeps working and `/api/mcp` answers with HTTP 501 and a message that says to install the package.

The endpoint is served under `mastra dev`, and in production only when `server.auth` is configured. **Apps that already configure `server.auth` get `/api/mcp` by default after upgrading.** To opt out, set `server.mcp.enabled` to `false`:

```ts
export const mastra = new Mastra({
  server: {
    auth,
    mcp: { enabled: false },
  },
});
```

The endpoint accepts only `Authorization: Bearer` credentials. Connecting needs the `mcp:read` permission, and seeing or calling tools needs `mcp:execute`. These are the same permission names that guard the routes of `MCPServer` instances you register, so a role granted them for your own MCP servers can also use the built-in one. Each call still needs the permission of its backing route, such as `agents:execute`.

```bash
claude mcp add --transport http mastra http://localhost:4111/api/mcp
```

Configure it with `server.mcp`. `include` and `exclude` match a primitive's `id` or the key it is registered under:

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
