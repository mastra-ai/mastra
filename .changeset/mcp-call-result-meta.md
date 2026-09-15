---
'@mastra/mcp': patch
---

`MCPServer` now includes available `_meta` on successful `tools/call` results.
MCP Apps hosts can detect linked apps from call results, and tool-provided metadata is preserved.
Results without metadata remain unchanged.
