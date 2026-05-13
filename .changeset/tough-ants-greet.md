---
'mastracode': minor
---

Improved OpenAI Codex OAuth support in Mastra Code, including a device-code mode for headless or remote environments. HTTP MCP server config can now pass OAuth client metadata to `@mastra/mcp` and store per-server OAuth state without sharing tokens across projects.

Example:

```sh
export MASTRACODE_OPENAI_CODEX_AUTH_MODE=device
```

```json
{
  "mcpServers": {
    "remote-api": {
      "url": "https://mcp.example.com/mcp",
      "oauth": {
        "redirectUrl": "http://localhost:3000/oauth/callback"
      }
    }
  }
}
```
