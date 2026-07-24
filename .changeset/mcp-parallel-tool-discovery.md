---
'@mastra/mcp': patch
---

Speed up MCP discovery when an `MCPClient` is configured with multiple servers. `listTools()`, `listToolsets()`, `resources.list()`, `resources.templates()`, and `prompts.list()` now query all configured servers concurrently instead of one at a time, so total discovery time is roughly the slowest single server rather than the sum of all of them, and one slow or unresponsive server no longer stalls discovery for the rest. Tool, resource, and prompt ordering and per-server error reporting are unchanged.
