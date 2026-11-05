---
'@mastra/mcp-apps-components': minor
---

`@mastra/mcp-apps-components` now ships plain MCP Apps that follow the MCP Apps spec, starting with `greetingApp`. Register it as an app resource on an `MCPServer` and write its two tools as regular Mastra tools: the tool the model calls to open it, and an app-only tool (`visibility: ['app']`) that it calls for its data.

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

**Breaking:** the dashboard app and its helpers are removed: `dashboardRendererApp`, `observabilityAppTools`, widget pinning, and the `./dashboard-renderer`, `./observability-tools` and `./host` entry points.
