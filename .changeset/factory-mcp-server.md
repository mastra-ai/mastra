---
'@mastra/factory': minor
---

Added a built-in MCP server to Factory at `/web/factory/projects/:projectId/mcp`. MCP clients such as ChatGPT can sign in with OAuth and use the Factory tools (work items, sessions, decisions, approvals, plus `search` and `fetch`) with the same permissions as the web UI. Factories on Mastra Platform auth sign users in through Platform automatically; other auth providers set `mcp.authorizationServers` (or `MASTRA_FACTORY_MCP_AUTHORIZATION_SERVER`). Pass `mcp: false` to turn it off.

```ts
new MastraFactory({
  // ...
  mcp: { authorizationServers: ['https://your-tenant.authkit.app'] },
});
```
