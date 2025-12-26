---
'@mastra/mcp': patch
---

Fixes the issue where MCP authentication context wasn't being passed to tools when called by agents. Tools can now access MCP context via `context.requestContext.get('mcp.extra')` when invoked via agents.

