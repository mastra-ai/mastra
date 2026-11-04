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

Each widget shows a pin button when the host says it can pin. The host owns the pinned widgets; the app only reports which ones the user wants. Everything goes through standard MCP Apps messages.

1. The host sets `mastra.ai/dashboard-pinned-widgets` in its host context to the ids of the widgets it has pinned (`[]` for none) and advertises `updateModelContext.structuredContent`. Without both, no pin buttons show.
2. When the user clicks a widget's button, the app sends `ui/update-model-context` with the **full list** of widgets the user wants pinned under the same key in `structuredContent`. Each entry is `{ widget, scope, defaults }`: the widget definition, the dashboard's scope, and the date range and filters the user had on, which together render the pinned widget on its own as the user saw it. The update also has a short text block describing the pins, so the model sees them too.
3. The host stores the change and sends the new list of ids back in its host context. Each button follows the host, not the click.

Every model context update replaces the previous one, so each update the dashboard sends carries both its pin state and its last drilldown. An update without the pin key carries no pin state; it never means "nothing pinned".

#### In a React host built on `@mastra/playground-ui`

`useMcpAppHost` from the `@mastra/mcp-apps-components/host` subpath does the parsing and routing. That subpath doesn't include the app's HTML, so it adds nothing heavy to the host bundle.

```tsx
import { useCallback, useState } from 'react';
import { McpAppHostProvider } from '@mastra/playground-ui/domains/mcps';
import { useMcpAppHost } from '@mastra/mcp-apps-components/host';
import type { McpAppRef, DashboardPinnedWidgetEntry } from '@mastra/mcp-apps-components/host';

function ChatWithPins({ children }: { children: React.ReactNode }) {
  // Widget ids are only unique within one dashboard, so key them by tool call.
  const [pins, setPins] = useState<Record<string, string[]>>({});

  const pinnedIds = useCallback(
    (app: McpAppRef) => (app.resourceUri === DASHBOARD_APP_URI ? (pins[app.toolCallId] ?? []) : undefined),
    [pins],
  );
  const onPinnedChange = (pinned: DashboardPinnedWidgetEntry[], app: McpAppRef) => {
    void savePinnedWidgets(app.toolCallId, pinned); // full list, not a change
    setPins(current => ({ ...current, [app.toolCallId]: pinned.map(entry => entry.widget.id) }));
  };

  const host = useMcpAppHost({ dashboardPins: { pinnedIds, onPinnedChange } });
  return <McpAppHostProvider value={host}>{children}</McpAppHostProvider>;
}
```

`pinnedIds` returns `[]` for none, `null` to turn pinning off for an app, or `undefined` for apps that aren't dashboards. Invalid payloads are dropped and logged, never passed to `onPinnedChange`.

#### With `AppBridge` directly

The params come from the app's iframe, so parse them with `dashboardPinnedWidgetsSchema` before storing or rendering anything.

```typescript
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import {
  DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY,
  dashboardPinnedWidgetsSchema,
} from '@mastra/mcp-apps-components/dashboard-renderer';

let hostContext = { theme: 'dark' as const, [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: [] as string[] };
const bridge = new AppBridge(
  client,
  hostInfo,
  { ...capabilities, updateModelContext: { text: {}, structuredContent: {} } },
  { hostContext },
);

bridge.onupdatemodelcontext = async ({ structuredContent }) => {
  if (!structuredContent || !(DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY in structuredContent)) return {};
  const parsed = dashboardPinnedWidgetsSchema.safeParse(structuredContent[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]);
  if (!parsed.success) return {};

  await savePinnedWidgets(parsed.data); // full list: diff it against what you stored
  // setHostContext replaces the whole context, so keep the other fields
  hostContext = { ...hostContext, [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: parsed.data.map(entry => entry.widget.id) };
  bridge.setHostContext(hostContext);
  return {};
};
```

Keep in mind:

- To turn pinning off, set the key to a non-array value such as `null`. Deleting the key does nothing, because `AppBridge` only sends the fields that changed, so the app keeps the last ids it got.
- Widget ids are only unique within one dashboard definition. Keep pinned ids per bridge (one tool call), not across dashboards.
- Until the host answers, the app builds each click on the previous one, so quick clicks don't drop pins. Once the host sends its list back, that list wins, including when it declines a pin.
- The app only knows the `defaults` of widgets pinned since it loaded. Widgets pinned earlier come back with the dashboard's current range and filters, so keep the entries you already store for those ids and only add the new ones.
- A widget that no longer parses shows no pin button, so the host owns unpinning it.

## Documentation

- [Build MCP Apps](https://mastra.ai/docs/connections/mcp)
- [`MCPServer` reference](https://mastra.ai/reference/tools/mcp-server)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/mcp-apps-components/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
