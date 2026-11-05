---
'@mastra/mcp-apps-components': minor
---

`@mastra/mcp-apps-components` now ships MCP Apps that use only messages from the MCP Apps spec. The first one is `greetingApp`, exported from the package root. To use it, register it as an app resource on an `MCPServer` and write its two tools as regular Mastra tools. The model calls one tool to open the app. The app calls the other, an app-only tool (`visibility: ['app']`), to get its data.

```ts
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { greetingApp } from '@mastra/mcp-apps-components';
import { z } from 'zod';

const uri = 'ui://mastra/greeting';

new MCPServer({
  id: 'greeting',
  name: 'Greeting',
  version: '1.0.0',
  appResources: { [uri]: greetingApp },
  tools: {
    showGreeting: createTool({
      id: 'showGreeting',
      description: 'Shows a greeting card for someone',
      inputSchema: z.object({ name: z.string() }),
      mcp: { _meta: { ui: { resourceUri: uri } } },
      execute: async ({ name }) => ({ name }),
    }),
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

**Breaking:** the dashboard app is removed. The `./dashboard-renderer` (`dashboardRendererApp`) and `./observability-tools` (`observabilityAppTools`) entry points no longer exist. The package also has no peer dependencies anymore, so `@mastra/server` is no longer required.
