---
'mastracode': minor
'@mastra/code-sdk': minor
---

Added the ability to disable MCP servers from the TUI. Use `/mcp disable <server-name|all>` to turn off one or all MCP servers and `/mcp enable <server-name|all>` to turn them back on, or toggle individual servers from the interactive `/mcp` selector. Add `--global` to apply the change across every project (e.g. `/mcp disable all --global` acts as an all-MCP kill switch). Disabled servers stay visible in `/mcp status` with a disabled marker that shows which scope disabled them, their tools are removed from the agent, and the state persists across restarts.
