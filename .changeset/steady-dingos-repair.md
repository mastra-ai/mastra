---
"@mastra/mcp": patch
---

Improved MCP tool discovery to retry once after reconnectable connection errors like `Connection closed` during `tools/list`.

`MCPClient.listToolsets()`, `listToolsetsWithErrors()`, and `listTools()` now attempt a reconnect before treating transient discovery failures as missing tools.
