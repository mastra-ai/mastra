---
'mastracode': patch
---

MCP stdio servers now resolve `${VAR}` references in their `env` values from the host environment, matching the existing behavior for HTTP server headers. You can reference secrets from the environment instead of hardcoding them in `mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```
