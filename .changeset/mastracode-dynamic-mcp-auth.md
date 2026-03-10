---
'mastracode': minor
---

Added OAuth authentication support for HTTP MCP servers. Set `"auth": "oauth"` in your `mcp.json` server config to enable the standard MCP OAuth flow. When the server requires authentication, mastracode opens a browser for authorization, exchanges the code for tokens, and persists them automatically. Token refresh is handled transparently.

**Example configuration:**

```json
{
  "mcpServers": {
    "enterprise-api": {
      "url": "https://mcp.corp.com/mcp",
      "headers": { "X-Client": "mastracode" },
      "auth": "oauth"
    }
  }
}
```

Static `headers` continue to work alongside OAuth — they are sent with every request in addition to the OAuth bearer token.
