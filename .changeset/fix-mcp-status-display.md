---
"mastracode": patch
---

Fix /mcp slash command now correctly displays MCP server status

The `/mcp` command always showed "MCP system not initialized" even when MCP servers were configured and working. Server status and `/mcp reload` now work as expected.
