---
'@mastra/mcp': patch
---

Add MCP progress notification support and refactor client structure

- Added progress notification support for MCP tool execution. Enable with `enableProgressTracking: true` in server config and use `client.progress.onUpdate(handler)` to receive progress updates during long-running tool operations.
- Added `ProgressClientActions` class for handling progress notifications
- Refactored client action classes into `actions/` directory (elicitation, prompt, resource, progress)
- Extracted all type definitions to a dedicated `types.ts` file for better code organization

