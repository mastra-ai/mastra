---
'@mastra/mcp': patch
---

Isolate per-server failures in `listTools()` and `listToolsets()` so one failing MCP server no longer collapses tool loading for all healthy servers.

**What changed:**

- `listTools()` and `listToolsets()` now use per-server `try/catch` with error logging instead of `Promise.all`, matching the existing pattern in `resources.list()` and `prompts.list()`
- `disconnect()` uses `Promise.allSettled` so one failing disconnect does not block others
- Removed unused `eachClientTools()` private method
