---
'mastra': minor
'@mastra/mcp': minor
---

Added new MCPConfiguration class for managing multiple MCP server tools/toolsets. Fixed a bug where MCPClient env would overwrite PATH env var. Fixed a bug where MCP servers would be killed non-gracefully leading to printing huge errors on every code save when running mastra dev
