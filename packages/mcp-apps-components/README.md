# @mastra/mcp-apps-components

Prebuilt [MCP Apps](https://mastra.ai/docs/connections/mcp) that you register as app resources on an `MCPServer`. Each app is a single self-contained HTML page that follows the [MCP Apps spec](https://github.com/modelcontextprotocol/ext-apps), so it runs in any MCP Apps host, such as Mastra Studio.

## Installation

```bash
npm install @mastra/mcp-apps-components
```

## Greeting app

`greetingApp` greets someone by name. It talks to its host with standard MCP Apps messages only:

1. The model calls the tool that opens the app. The host sends the app that tool's arguments (`ui/notifications/tool-input`); the app reads `name`.
2. The app calls the app-only `getGreeting` tool on the same server (`tools/call`) and shows the `greeting` string from its structured content, or the tool's error.
3. A **Say hi back** button posts a user message to the conversation (`ui/message`).

You write both tools. `getGreeting` runs on your server, so it can call any API with your server's credentials; the app's iframe has no network access.

```typescript
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { greetingApp } from '@mastra/mcp-apps-components';
import { z } from 'zod';

const uri = 'ui://mastra/greeting';

export const greetingServer = new MCPServer({
  id: 'greeting',
  name: 'Greeting',
  version: '1.0.0',
  appResources: { [uri]: greetingApp },
  tools: {
    // Visible to the model: opens the app.
    showGreeting: createTool({
      id: 'showGreeting',
      description: 'Shows a greeting card for someone',
      inputSchema: z.object({ name: z.string() }),
      mcp: { _meta: { ui: { resourceUri: uri } } },
      execute: async ({ name }) => ({ name }),
    }),
    // Visible to the app only: returns its data.
    getGreeting: createTool({
      id: 'getGreeting',
      description: 'Returns the greeting for a name',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ greeting: z.string() }),
      mcp: { _meta: { ui: { resourceUri: uri, visibility: ['app'] } } },
      execute: async ({ name }) => ({ greeting: `Hello, ${name}!` }),
    }),
  },
});
```

## License

Apache-2.0
