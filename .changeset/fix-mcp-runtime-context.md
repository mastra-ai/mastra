---
"@mastra/mcp": patch
---

fix(mcp): populate RuntimeContext from options.extra for workflows and agents

Workflows and agents exposed as MCP tools now receive authentication information through RuntimeContext when options.extra.authInfo is provided. This fixes the issue where workflows/agents couldn't access authentication context when exposed via MCPServer.