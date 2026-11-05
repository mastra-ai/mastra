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
2. When the user clicks a widget's button, the app sends `ui/update-model-context` with the **full list** of widgets the user wants pinned under the same key in `structuredContent`. Each entry is `{ widget, scope, defaults? }`: the widget definition, the dashboard's scope, and the date range and filters the user had on, which together render the pinned widget on its own as the user saw it. Only widgets pinned since the app loaded carry `defaults`; for the rest, keep the defaults you stored. The update also has a short text block describing the pins, so the model sees them too, and a request number under `mastra.ai/dashboard-pin-request`.
3. The host stores what it accepts and sends back, in its host context, the new list of ids and the request number it handled. Each button follows the host, not the click.

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

`pinnedIds` returns `[]` for none, `null` to turn pinning off for an app, or `undefined` for apps that aren't dashboards. The hook echoes each handled request number back for you once `onPinnedChange` returns or its promise settles, so update `pinnedIds` by then; ids you don't add are pins you turned down. If `onPinnedChange` throws or rejects, the error is logged and the pins count as turned down. Invalid payloads are dropped and logged, never passed to `onPinnedChange`.

#### With `AppBridge` directly

The params come from the app's iframe, so parse them with `dashboardPinnedWidgetsSchema` before storing or rendering anything.

```typescript
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import {
  DASHBOARD_PIN_REQUEST_CONTEXT_KEY,
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

  const ids = await savePinnedWidgets(parsed.data); // full list: diff it, return the ids you kept
  // setHostContext replaces the whole context, so keep the other fields. Echo the request number,
  // so the app knows you answered even when you turned a pin down and the ids stay the same.
  hostContext = {
    ...hostContext,
    [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: ids,
    [DASHBOARD_PIN_REQUEST_CONTEXT_KEY]: structuredContent[DASHBOARD_PIN_REQUEST_CONTEXT_KEY],
  };
  bridge.setHostContext(hostContext);
  return {};
};
```

Keep in mind:

- To turn pinning off, set the key to a non-array value such as `null`. Deleting the key does nothing, because `AppBridge` only sends the fields that changed, so the app keeps the last ids it got.
- Widget ids are only unique within one dashboard definition. Keep pinned ids per bridge (one tool call), not across dashboards.
- Until the host answers a click, the app applies it on top of the host's ids, so quick clicks don't drop pins. A click is answered once the host echoes a request number at or above the one it was sent with, or once the host's ids already reflect it. A pin the host declines then drops, and the next click doesn't resend it.
- If the app's model context update fails, its clicks drop, and the buttons show the host's ids again.
- A widget that no longer parses shows no pin button, so the host owns unpinning it.

## Documentation

- [Build MCP Apps](https://mastra.ai/docs/connections/mcp)
- [`MCPServer` reference](https://mastra.ai/reference/tools/mcp-server)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/mcp-apps-components/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
