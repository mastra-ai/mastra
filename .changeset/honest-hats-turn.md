---
'@mastra/mcp': minor
'@mastra/core': minor
---

Added MCP server instructions forwarding into agent system prompts.

When an MCP server advertises instructions during initialization, agents that use tools from `MCPClient` now receive that guidance as a separate system message by default. This is enabled out of the box — if your MCP servers already publish instructions, agent behavior may change on upgrade because the model now sees that guidance.

Set `forwardInstructions: false` on any server to opt out:

```ts
const mcp = new MCPClient({
  servers: {
    db: {
      url: new URL('http://localhost:4111/mcp'),
      // Both options below are the defaults — shown for clarity:
      forwardInstructions: true,   // set to false to suppress
      instructionsMaxLength: 512,  // max chars forwarded per server
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

You can also inspect cached instructions without forwarding them:

```ts
const instructions = mcp.getServerInstructions();
// => { db: 'Always validate before migrating.', other: undefined }
```
