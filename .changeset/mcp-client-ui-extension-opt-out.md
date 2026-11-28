---
'@mastra/mcp': patch
---

Mastra MCP clients no longer overwrite the `io.modelcontextprotocol/ui` (MCP Apps) extension capability. A server's `capabilities.extensions` are merged as configured: set `io.modelcontextprotocol/ui` to `false` or `null` to opt out of the extension, or to an object to customise its settings. Other extension entries pass through unchanged, and the `io.modelcontextprotocol/tasks` extension is still added when `tasks` is enabled. Enabling the dedicated `tasks` option takes precedence: it advertises `io.modelcontextprotocol/tasks` as `{}`, overriding any entry set for that id (including `false`, `null` or a custom object).

Fixes #31295.
