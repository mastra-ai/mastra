---
"mastracode": patch
---

Refactor MCPManager class to a factory function

Replace the `MCPManager` class with a `createMcpManager()` factory function and a `McpManager` interface. This simplifies the public API by using closure state instead of class fields while preserving all existing behavior (TUI `/mcp` command, tool collection, config merging).
