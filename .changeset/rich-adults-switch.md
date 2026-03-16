---
'@mastra/mcp': patch
---

Fixed regular tools executed via MCPServer now receive `requestContext` populated from `mcp.extra`, matching the behavior of agent and workflow tools. All tool types now consistently propagate authentication and request context.
