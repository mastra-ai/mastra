---
'@mastra/mcp-docs-server': major
---

The docs server now runs on `@mastra/mcp` 2.x and speaks the MCP `2026-07-28` revision over stdio. Tools that have not adopted that revision fail to connect with a version-negotiation error; pin the previous major for those:

```json
{
  "mcpServers": {
    "mastra": {
      "command": "npx",
      "args": ["-y", "@mastra/mcp-docs-server@^1"]
    }
  }
}
```

Server-level `notifications/message` logging is gone with the protocol revision. The server's own log output now goes to stderr, filtered by `--log-level`, and error logs are still written to `~/.cache/mastra/mcp-docs-server-logs`. The migration prompts no longer carry the removed `version` field.
