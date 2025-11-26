---
"@mastra/mcp": patch
---

fix(mcp): populate RequestContext from options.extra for workflows and agents

Workflows and agents exposed as MCP tools now receive all MCP extra information (including authInfo, sessionId, requestId, etc.) through RequestContext when options.extra is provided. This fixes the issue where workflows and agents couldn't access authentication context and other MCP metadata when exposed via MCPServer.

