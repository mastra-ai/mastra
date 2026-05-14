---
'mastracode': minor
---

Improved OpenAI Codex OAuth support in Mastra Code. When you select the Codex provider in `/login` or during onboarding, Mastra Code now asks how to sign in — **Browser (local callback)** or **Device code (headless)** — so the device-code flow is discoverable without setting an env var. `MASTRACODE_OPENAI_CODEX_AUTH_MODE=device` still works as a preselect for scripted environments.

HTTP MCP server config can now pass OAuth client metadata to `@mastra/mcp` and store per-server OAuth state without sharing tokens across projects:

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
