---
'@mastra/mcp': patch
---

List resources and prompts from all MCP servers concurrently in `MCPClient.resources.list()`, `resources.templates()`, and `prompts.list()`.

These methods previously queried each configured server one at a time in a serial loop, so a slow or unresponsive server delayed the aggregate result for every server behind it. They now fan out with `Promise.all`, matching the tool-discovery methods and the parallel teardown in `disconnect()`. Results are keyed by server and assembled in configuration order, and per-server failures are still logged and skipped, so behavior is otherwise unchanged.
