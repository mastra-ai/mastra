---
'@mastra/code-sdk': minor
'mastracode': minor
---

Zero-config MCP OAuth now identifies Mastra Code with its Client ID Metadata Document (`https://mastra.ai/.well-known/oauth-client/mastracode.json`) instead of dynamic client registration, which `@mastra/mcp` 2.x no longer performs. Servers whose authorization server accepts URL-based client IDs keep working with a bare `url` entry; servers that require a registered client need `oauth.clientId` in `mcp.json`.

```json
{
  "mcpServers": {
    "notes": {
      "url": "https://notes.example.com/mcp"
    },
    "billing": {
      "url": "https://billing.example.com/mcp",
      "oauth": {
        "clientId": "mastra-code-billing",
        "scopes": ["invoices:read"]
      }
    }
  }
}
```
