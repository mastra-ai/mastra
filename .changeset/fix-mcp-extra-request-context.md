---
'@mastra/mcp': patch
---

Workflows and agents exposed as MCP tools now receive all keys from `options.extra` directly on the RequestContext. This allows workflows and agents to access authentication information (authInfo, sessionId, requestId, etc.) via `requestContext.get('key')` when exposed via MCPServer.

