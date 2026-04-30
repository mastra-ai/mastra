---
"@mastra/core": patch
"@mastra/editor": patch
"@mastra/server": patch
---

Fix MCP client support in the agent editor:
- MCP client form dirty state: Save button now enables after adding/removing MCP clients
- MCP tool name matching: Both bare and namespaced tool names are matched correctly
- Auth token forwarding: Token from cookie or header is forwarded to auth-protected MCP servers
- String interpolation: Request context variables in system prompts now resolve correctly
