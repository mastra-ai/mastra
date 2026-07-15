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
optional (it defaults to a stable loopback URL).
