---
'@mastra/mcp': patch
---

Mastra MCP clients no longer overwrite the `io.modelcontextprotocol/ui` (MCP Apps) extension capability. A server's `capabilities.extensions` are merged as configured: set `io.modelcontextprotocol/ui` to `false` or `null` to opt out of the extension, or to an object to customise its settings. Other extension entries pass through unchanged, and the `io.modelcontextprotocol/tasks` extension is still added when `tasks` is enabled.

Fixes #31295.
