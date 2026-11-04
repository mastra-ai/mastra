# @mastra/mcp-apps-components

Prebuilt [MCP Apps](https://mastra.ai/docs/connections/mcp) that render Mastra UI components inside any MCP App host, such as Mastra Studio. Each app ships as a self-contained HTML resource you register on an `MCPServer`, plus a server-side helper to link it to your tools.

The apps never reach the network from their iframe. They read data by calling the app-only `mastraApi` tool on the same server, which agents don't see.

## Installation

```bash
npm install @mastra/mcp-apps-components
```

## Usage

Register the dashboard renderer and the `mastraApi` relay on an `MCPServer`, then return a dashboard definition from a tool linked to the app's `ui://` URI.

```typescript
import type { DashboardDefinition } from '@mastra/core/storage/dashboards';
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { dashboardRendererApp, dashboardRendererInputSchema } from '@mastra/mcp-apps-components/dashboard-renderer';
import { MASTRA_API_TOOL, mastraApiTool } from '@mastra/mcp-apps-components/mastra-api';
import { z } from 'zod';

const DASHBOARD_APP_URI = 'ui://mastra/dashboard';

const agentRuns: DashboardDefinition = {
  schemaVersion: 1,
  defaults: { datePreset: '7d' },
  rows: [
    {
      widgets: [
        {
          id: 'runs',
          span: 12,
          kind: 'kpis',
          views: [
            {
              queries: [
                {
                  id: 'runs',
                  source: 'metrics',
                  request: 'aggregate',
                  name: ['mastra_agent_duration_ms'],
                  aggregation: 'count',
                },
              ],
              options: { items: [{ label: 'Agent runs', format: 'count', value: { query: 'runs' } }] },
            },
          ],
        },
      ],
    },
  ],
};

const showAgentRuns = createTool({
  id: 'showAgentRuns',
  description: 'Shows how many agent runs happened in the last 7 days',
  inputSchema: z.object({}),
  outputSchema: dashboardRendererInputSchema,
  mcp: { _meta: { ui: { resourceUri: DASHBOARD_APP_URI } } },
  execute: async () => ({ definition: agentRuns, scope: 'project' as const }),
});

export const dashboardServer = new MCPServer({
  id: 'dashboard-server',
  name: 'Dashboard Server',
  version: '1.0.0',
  appResources: { [DASHBOARD_APP_URI]: dashboardRendererApp() },
  tools: { showAgentRuns, [MASTRA_API_TOOL]: mastraApiTool },
});
```

`mastraApi` only answers read-only observability routes and forwards the caller's auth token, so the app sees the same data the signed-in user can.

## Documentation

- [Build MCP Apps](https://mastra.ai/docs/connections/mcp)
- [`MCPServer` reference](https://mastra.ai/reference/tools/mcp-server)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/mcp-apps-components/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
