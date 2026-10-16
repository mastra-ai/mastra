---
'@mastra/factory': minor
---

Added a built-in MCP server to every Factory with an auth provider, at `/web/factory/projects/:projectId/mcp`. MCP clients such as ChatGPT can sign in with OAuth and use the Factory tools (work items, sessions, decisions, approvals, plus `search` and `fetch`) with the same permissions as the web UI. Pass `mcp: false` to turn it off.
