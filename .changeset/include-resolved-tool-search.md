---
'@mastra/core': patch
---

Added `includeResolvedTools` to ToolSearchProcessor so per-request tools (such as MCP toolsets) can be discovered via `search_tools` and `load_tool` without being injected into the prompt until loaded. Fixes #14127.

```typescript
const toolSearch = new ToolSearchProcessor({
  tools: {},
  includeResolvedTools: true,
});

const agent = new Agent({
  inputProcessors: [toolSearch],
  tools: {},
});

await agent.stream('Create a github issue', {
  toolsets: await mcpClient.listToolsets(),
});
```
