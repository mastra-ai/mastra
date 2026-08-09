---
'@mastra/core': minor
---

Add `includeResolvedTools` to `ToolSearchProcessor`, making per-request tools (MCP tools that need the caller's credentials, or anything returned by a dynamic `tools` function) searchable and withholding them from the prompt until the agent loads them. Previously only tools listed at construction could be searched, so dynamically resolved tools were always sent in full.

```ts
const toolSearch = new ToolSearchProcessor({
  tools: staticTools,
  includeResolvedTools: true,
})

const agent = new Agent({
  id: 'mcp-agent',
  name: 'mcp-agent',
  instructions: 'Search for a tool when you need a capability you do not have.',
  model: 'openai/gpt-5.6-sol',
  // Resolved per request, then searchable alongside staticTools
  tools: async ({ requestContext }) => mcpClient.getTools(requestContext.get('userToken')),
  inputProcessors: [toolSearch],
})
```
