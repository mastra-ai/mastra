---
'@mastra/mcp-docs-server': minor
---

The docs server now runs on `@mastra/mcp` 2.x and serves the MCP `2026-07-28` revision over stdio. Editors that still open with the pre-2026 `initialize` handshake (Cursor, Codex CLI, VS Code and Claude Code at the time of writing) keep working: the server reads the first request on stdin and, when it is an `initialize`, serves the connection with the published `@mastra/mcp` 1.x implementation instead. The same tools and prompts are registered either way, so `npx -y @mastra/mcp-docs-server@latest` needs no configuration change.

```json
{
  "mcpServers": {
    "mastra": {
      "command": "npx",
      "args": ["-y", "@mastra/mcp-docs-server@latest"]
    }
  }
}
```

The startup log line on stderr now reports which protocol was selected, for example `{"level":"info","message":"Started Mastra Docs MCP Server","data":{"protocol":"legacy"}}`. Server-level `notifications/message` logging is gone with the 2.x protocol; the server's own log output goes to stderr, filtered by `--log-level`, and error logs are still written to `~/.cache/mastra/mcp-docs-server-logs`. The migration prompts no longer carry the removed `version` field, and the package's `server` export is replaced by `createDocsServer(era)`.
