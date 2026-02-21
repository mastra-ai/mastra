---
'@mastra/core': minor
'@mastra/editor': minor
---

Added MCP server storage and editor support. MCP server configurations can now be persisted in storage and managed through the editor CMS. The editor's `mcpServer` namespace provides full CRUD operations and automatically hydrates stored configs into running `MCPServer` instances by resolving tool, agent, and workflow references from the Mastra registry.

```ts
const editor = new MastraEditor();
const mastra = new Mastra({
  tools: { getWeather: weatherTool, calculate: calculatorTool },
  storage: new LibSQLStore({ url: ':memory:' }),
  editor,
});

// Store an MCP server config referencing tools by ID
const server = await editor.mcpServer.create({
  id: 'my-server',
  name: 'My MCP Server',
  version: '1.0.0',
  tools: { getWeather: {}, calculate: { description: 'Custom description' } },
});

// Retrieve — automatically hydrates into a real MCPServer with resolved tools
const mcp = await editor.mcpServer.getById('my-server');
const tools = mcp.tools(); // { getWeather: ..., calculate: ... }
```
