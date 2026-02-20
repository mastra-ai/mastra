---
"mastracode": patch
---

Fix /mcp slash command always showing "MCP system not initialized"

The `/mcp` command was calling `this.harness.getMcpManager?.()` but the Harness class has no such method, so it always returned undefined. Fixed by passing the `mcpManager` instance directly to the TUI via `MastraTUIOptions`, following the same pattern used for `hookManager` and `authStorage`.
