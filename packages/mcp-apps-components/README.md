# @mastra/mcp-apps-components

Prebuilt [MCP Apps](https://mastra.ai/docs/connections/mcp) that render Mastra UI components inside any MCP App host, such as Mastra Studio. Each app ships as a self-contained HTML resource you register on an `MCPServer`, plus a server-side helper to link it to your tools.

The apps never reach the network from their iframe. They read data by calling app-only observability tools on the same server, which agents don't see.

## Installation

```bash
npm install @mastra/mcp-apps-components
```

## Usage

Register the dashboard renderer and `observabilityAppTools` on an `MCPServer`, then return a dashboard definition from a tool linked to the app's `ui://` URI.

```typescript
import type { DashboardDefinition } from '@mastra/core/storage/dashboards';
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { dashboardRendererApp, dashboardRendererInputSchema } from '@mastra/mcp-apps-components/dashboard-renderer';
import { observabilityAppTools } from '@mastra/mcp-apps-components/observability-tools';
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
  tools: { showAgentRuns, ...observabilityAppTools },
});
```

Each tool runs its read-only observability route in-process as the caller, with the route's own validation, authentication, permission and FGA checks, so the app sees the same data the signed-in user can.

### Pinning widgets

Each widget shows a pin button when the host says it can pin. The host owns the pinned widgets; the app only asks it to change them.

1. The host sets `mastra.ai/dashboard-pinned-widgets` in its host context to the ids of the widgets it has pinned (`[]` for none). Without it, no pin buttons show.
2. When the user clicks a widget's button, the app sends a `mastra.ai/dashboard-widget-pin` notification with `{ widget, scope, isPinned }`: the widget definition, the dashboard's scope, and the state the user wants. The host can render the pinned widget on its own from `widget` and `scope`.
3. The host stores the change and sends the new list of ids back in its host context. Each button follows the host, not the click.

```typescript
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import {
  DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY,
  DASHBOARD_WIDGET_PIN_NOTIFICATION,
} from '@mastra/mcp-apps-components/dashboard-renderer';
import type { DashboardWidgetPinNotificationParams } from '@mastra/mcp-apps-components/dashboard-renderer';

const bridge = new AppBridge(client, hostInfo, capabilities, {
  hostContext: { [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: pinnedWidgetIds },
});

bridge.fallbackNotificationHandler = async ({ method, params }) => {
  if (method !== DASHBOARD_WIDGET_PIN_NOTIFICATION) return;
  const { widget, scope, isPinned } = params as DashboardWidgetPinNotificationParams;
  const ids = isPinned ? await pinWidget(widget, scope) : await unpinWidget(widget.id);
  bridge.setHostContext({ [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: ids });
};
```

## Documentation

- [Build MCP Apps](https://mastra.ai/docs/connections/mcp)
- [`MCPServer` reference](https://mastra.ai/reference/tools/mcp-server)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/mcp-apps-components/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
