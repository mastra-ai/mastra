---
'@mastra/mcp': minor
---

Complete the OAuth authorization-code loop in MCPClient for HTTP MCP servers. Connections rejected with an authorization error now surface a `needs-auth` state (readable via `getServerAuthState()`), and the new `authenticate(serverName)` method runs the interactive flow end to end: it captures the authorization code on a local loopback callback server (exported as `createOAuthCallbackServer` for hosts with custom redirect handling), exchanges it for tokens, and reconnects.
