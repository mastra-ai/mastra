---
'@mastra/mcp': minor
'@mastra/core': minor
---

Added MCP server instructions forwarding into agent system prompts.

When an MCP server advertises instructions during initialization, agents that use tools from `MCPClient` now receive that guidance in their system prompt by default.

```ts
const mcp = new MCPClient({
  servers: {
    db: {
      url: new URL('http://localhost:4111/mcp'),
      forwardInstructions: true,
      instructionsMaxLength: 512,
    },
  },
});

const agent = new Agent({
  id: 'db-agent',
  name: 'DB Agent',
  instructions: 'Help with database changes.',
  model,
  tools: await mcp.listTools(),
});
```
