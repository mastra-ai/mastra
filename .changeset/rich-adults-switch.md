---
'@mastra/mcp': patch
---

Fixed regular tools executed via MCPServer missing requestContext populated from mcp.extra. Agent tools and workflow tools already proxied auth info into requestContext, but regular tools in the CallToolRequestSchema handler did not. Now all tool types consistently populate requestContext from mcp.extra.
