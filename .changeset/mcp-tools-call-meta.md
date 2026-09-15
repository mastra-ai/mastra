---
'@mastra/mcp': patch
---

Fixed MCP `tools/call` results dropping the tool's `_meta`, so third-party (non-Studio) MCP hosts can now detect and render MCP Apps. Fixes #21277.
