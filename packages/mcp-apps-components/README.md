# @mastra/mcp-apps-components

Prebuilt [MCP Apps](https://mastra.ai/docs/connections/mcp) that render Mastra UI components inside any MCP App host, such as Mastra Studio. Each app ships as a self-contained HTML resource you register on an `MCPServer`, plus a server-side helper to link it to your tools.

The apps never reach the network from their iframe. Each read they make travels as a call to one app-only data tool that you register on the same server.

## Installation

```bash
npm install @mastra/mcp-apps-components
```

## Usage

Register the dashboard renderer on an `MCPServer`, then return a dashboard definition from a tool linked to the app's `ui://` URI.

```typescript
import type { DashboardDefinition } from '@mastra/core/storage/dashboards';
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { dashboardDataTool } from '@mastra/mcp-apps-components/dashboard-data-tool';
import { dashboardRendererApp, dashboardRendererInputSchema } from '@mastra/mcp-apps-components/dashboard-renderer';
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
  tools: { showAgentRuns, dashboardDataTool },
});
```

### Data tool

Register `dashboardDataTool`, from `@mastra/mcp-apps-components/dashboard-data-tool`, under that exact key, next to the app. The app calls it by name for every read its dashboard makes, such as `getMetricAggregate`. Without it, each widget fails with a message telling you to register it.

The tool runs the observability route behind each read in-process as the caller, with `invokeRoute()` from `@mastra/server`, so the route's own validation, authentication, permission and FGA checks apply and the app sees the same data the signed-in user can. It only answers the reads in `DASHBOARD_DATA_OPERATIONS`, and it's app-only, so hosts keep it away from the model.

Only the `dashboard-data-tool` entry needs `@mastra/server`, which any Mastra server already has. When the server has authentication configured, reads made over an MCP transport that carries no signed-in user, such as stdio, answer with `401`.

### Answering the data tool yourself

A host that reads observability data its own way, such as one serving several projects, can register its own `dashboardDataTool` instead. Import the contract from `@mastra/mcp-apps-components/dashboard-renderer`, which doesn't load `@mastra/server`: `DASHBOARD_DATA_TOOL_NAME`, `DASHBOARD_DATA_OPERATIONS`, `DASHBOARD_DATA_REQUESTS`, `dashboardDataInputSchema` and `dashboardDataOutputSchema`.

To tell the tool which project to read, set `projectId` in the dashboard's tool result. The app sends it as `projectId` on every data tool call. Mastra's `dashboardDataTool` reads the one project its server holds and ignores it.

### Pinning widgets

Each widget shows a pin button when the host says it can pin. The host owns the pinned widgets; the app only asks it to change them.

1. The host sets `mastra.ai/dashboard-pinned-widgets` in its host context to the ids of the widgets it has pinned (`[]` for none). Without it, no pin buttons show.
2. When the user clicks a widget's button, the app sends a `mastra.ai/dashboard-widget-pin` notification with `{ widget, scope, defaults, isPinned }`: the widget definition, the dashboard's scope, the date range and filters the user had on, and the state the user wants. Together, `widget`, `scope`, and `defaults` render the pinned widget on its own as the user saw it.
3. The host stores the change and sends the new list of ids back in its host context. Each button follows the host, not the click.

The params come from the app's iframe, so parse them with `dashboardWidgetPinNotificationParamsSchema` before storing or rendering anything.

```typescript
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import {
  DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY,
  DASHBOARD_WIDGET_PIN_NOTIFICATION,
  dashboardWidgetPinNotificationParamsSchema,
} from '@mastra/mcp-apps-components/dashboard-renderer';

let hostContext = { theme: 'dark' as const, [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: [] as string[] };
const bridge = new AppBridge(client, hostInfo, capabilities, { hostContext });

bridge.fallbackNotificationHandler = async ({ method, params }) => {
  if (method !== DASHBOARD_WIDGET_PIN_NOTIFICATION) return;
  const parsed = dashboardWidgetPinNotificationParamsSchema.safeParse(params);
  if (!parsed.success) return;
  const { widget, scope, defaults, isPinned } = parsed.data;

  const pinned = hostContext[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY];
  if (isPinned === pinned.includes(widget.id)) return;
  await (isPinned ? savePinnedWidget({ widget, scope, defaults }) : deletePinnedWidget(widget.id));

  const ids = isPinned ? [...pinned, widget.id] : pinned.filter(id => id !== widget.id);
  // setHostContext replaces the whole context, so keep the other fields
  hostContext = { ...hostContext, [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: ids };
  bridge.setHostContext(hostContext);
};
```

Keep in mind:

- To turn pinning off, set the key to a non-array value such as `null`. Deleting the key does nothing, because `AppBridge` only sends the fields that changed, so the app keeps the last ids it got.
- Widget ids are only unique within one dashboard definition. Keep pinned ids per bridge (one tool call), not across dashboards.
- A widget that no longer parses shows no pin button, so the host owns unpinning it.

## Documentation

- [Build MCP Apps](https://mastra.ai/docs/connections/mcp)
- [`MCPServer` reference](https://mastra.ai/reference/tools/mcp-server)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/mcp-apps-components/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
