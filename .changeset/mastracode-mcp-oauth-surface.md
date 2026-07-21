---
'@mastra/code-sdk': minor
'mastracode': minor
---

Add browser-based OAuth authentication for HTTP MCP servers to Mastra Code.

When an HTTP MCP server rejects a connection with an authorization error, the
`/mcp` selector now shows a "needs auth" badge and an **Authenticate** action.
Choosing it opens the provider's consent page in the browser and completes the
OAuth 2.1 authorization-code flow (PKCE + Dynamic Client Registration) over a
loopback callback server, persists the tokens, and reconnects — no manual
configuration required for a bare `{ "url": ... }` server entry. A **Cancel
authentication** action aborts an in-flight flow and returns the server to the
needs-auth state.

The server manager gains `authenticateServer(name)` and
`cancelServerAuthentication(name)`, `McpServerStatus` gains an optional
`needsAuth` flag, and the OAuth `redirectUrl` in MCP server config is now
optional (it defaults to a stable loopback URL). The config also accepts
`callbackPort` as a shorthand that synthesizes
`http://localhost:<callbackPort>/callback`, the Claude Code / Codex
convention, so configs written for those clients (like Slack's official MCP
plugin config) work verbatim. `callbackPort` and `redirectUrl` are mutually
exclusive.

```ts
const server = manager.getServerStatuses().find(s => s.name === 'supabase');
if (server?.needsAuth) {
  // Opens the consent page in the browser, completes the OAuth flow, and
  // resolves with the reconnected server status.
  const status = await manager.authenticateServer('supabase', {
    onAuthorizationUrl: url => openInBrowser(url),
  });
  console.log(status.connected);

  // Abort an abandoned browser flow and return the server to needs-auth:
  // await manager.cancelServerAuthentication('supabase')
}
```
