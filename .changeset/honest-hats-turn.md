---
'@mastra/mcp': minor
'@mastra/core': minor
---

Added opt-in MCP server instructions forwarding into agent system prompts.

When an MCP server advertises instructions during initialization, you can now forward that guidance into the system prompt of agents that use the server's tools. This is **opt-in** — set `forwardInstructions: true` per server to enable it. Forwarded instructions are injected into the agent's system prompt, so only enable this for servers you trust.

```ts
const mcp = new MCPClient({
  servers: {
    db: {
      url: new URL('http://localhost:4111/mcp'),
      forwardInstructions: true, // opt in; defaults to false
      instructionsMaxLength: 512, // max chars forwarded per server
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

You can always inspect cached instructions without forwarding them:

```ts
const instructions = mcp.getServerInstructions();
// => { db: 'Always validate before migrating.', other: undefined }
```
