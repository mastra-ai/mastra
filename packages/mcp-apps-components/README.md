# @mastra/mcp-apps-components

Prebuilt [MCP Apps](https://mastra.ai/docs/connections/mcp) that you register as app resources on an `MCPServer`. Each app is a single self-contained HTML page that follows the [MCP Apps spec](https://github.com/modelcontextprotocol/ext-apps), so it runs in any MCP Apps host, such as Mastra Studio.

## Installation

```bash
npm install @mastra/mcp-apps-components
```

## Usage

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

### Observability dashboard

`observabilityWidgetApp` draws a Studio dashboard (rows of KPIs, time series, tables and scores widgets) with the same components Studio uses. Each widget loads and fails on its own.

1. The model calls the tool that opens the app. That tool must declare an `outputSchema` so its result reaches the app as structured content: `{ dashboard, datePreset? }`, where `dashboard` passes `dashboardDefinitionSchema` from `@mastra/core/storage/dashboards` and `datePreset` is one of `24h`, `3d`, `7d`, `14d` or `30d`. Without `datePreset`, the app uses the dashboard's `defaults.datePreset` when it is one of those, else `24h`. The window ends when the app opens. The dashboard's top-level `defaults.filters` chips filter every widget.
2. The app reads its data through the app-only `queryObservability` tool (exported as `QUERY_OBSERVABILITY_TOOL`). It calls it once per read with `{ action, args }`, where `action` is a `MastraClient` observability method (`getMetricAggregate`, `getMetricTimeSeries`, `listScores`, `aggregateTraces`, …) and `args` are that method's arguments, with dates as ISO strings. The tool returns `{ data }`, the method's result; if it throws, that widget shows as failed.

Use `observabilityDashboardInputSchema` as the opening tool's input and `toObservabilityDashboard` as its `execute`:

- The schema advertises every widget kind's options to the model, so the model can write its own widgets, and a wrong one fails input validation with errors the model can act on.
- The schema names the metrics Mastra records, but leaves metric names free: a name that doesn't exist reads as zero rather than failing. To make the model pick only metrics that have data, build the schema with `createObservabilityDashboardInputSchema({ metricNames })`, passing the names from `MastraClient#getMetricNames`. Unknown names are then rejected with the list of valid ones. Past `OBSERVABILITY_CATALOG_MAX_METRIC_NAMES` (200) names, or with none, they stay free. The schema is a snapshot, so rebuild the tool (`server.toolActions.add`) when the names change; `examples/agent` does this before each agent run.
- Label keys and values aren't listed. Give the model a tool that looks them up (for example with `MastraClient#getMetricLabelKeys` and `getMetricLabelValues`).
- Widgets without an `id` get a fresh UUID on every open, so the host can pin each one by an id that stays stable when the result is shown again.

The tools run on your server, so you decide which Mastra server the dashboard reads from and how it authenticates. Only allow read actions:

```typescript
import { MastraClient } from '@mastra/client-js';
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import {
  QUERY_OBSERVABILITY_TOOL,
  observabilityDashboardInputSchema,
  observabilityDashboardOutputSchema,
  observabilityWidgetApp,
  toObservabilityDashboard,
} from '@mastra/mcp-apps-components';
import { z } from 'zod';

const uri = 'ui://mastra/observability-widget';
const client = new MastraClient({ baseUrl: process.env.MASTRA_URL! });
const ACTIONS = ['getMetricAggregate', 'getMetricTimeSeries', 'getMetricPercentiles'] as const;

export const observabilityServer = new MCPServer({
  id: 'observability',
  name: 'Observability',
  version: '1.0.0',
  appResources: { [uri]: observabilityWidgetApp },
  tools: {
    // Visible to the model: opens the app with a dashboard.
    showObservabilityDashboard: createTool({
      id: 'showObservabilityDashboard',
      description: 'Shows an observability dashboard of kpis, timeseries, table and scores widgets.',
      inputSchema: observabilityDashboardInputSchema,
      outputSchema: observabilityDashboardOutputSchema,
      mcp: { _meta: { ui: { resourceUri: uri } } },
      execute: async input => toObservabilityDashboard(input),
    }),
    // Visible to the app only: runs one read on the server's client.
    [QUERY_OBSERVABILITY_TOOL]: createTool({
      id: QUERY_OBSERVABILITY_TOOL,
      description: 'Runs one observability read',
      inputSchema: z.object({ action: z.enum(ACTIONS), args: z.record(z.string(), z.unknown()) }),
      outputSchema: z.object({ data: z.unknown() }),
      mcp: { _meta: { ui: { resourceUri: uri, visibility: ['app'] } } },
      execute: async ({ action, args }) => {
        const read = client[action].bind(client) as (args: unknown) => Promise<unknown>;
        return { data: await read(args) };
      },
    }),
  },
});
```

The input names each widget, read and column option by a key instead of a `kind`, `source` or `type` field, so a validation error points at the part that's wrong:

```ts
{ id: 'runs', timeseries: { queries: [{ id: 'runs', metricTimeSeries: { name: 'mastra_agent_duration_ms', aggregation: 'count' } }], options: { … } } }
```

A host can also build a dashboard itself: `toObservabilityDashboard({ dashboard: { rows: [{ widgets: [runsWidget] }] }, datePreset: '7d' })` returns `{ dashboard, datePreset? }` as a regular `dashboardDefinitionSchema` definition and throws when the input is invalid.

`examples/agent` has a complete version with every read action and an agent that opens dashboards.

#### Pinning widgets

When the chat host supports it, each widget shows a pin button. The host owns the pinned widgets: it sends their ids to the app, and the app reports each pin and unpin through `ui/update-model-context`. In a host built on `@mastra/playground-ui`, pass `observabilityWidgetPins` from `@mastra/mcp-apps-components/host` to `McpAppHostProvider`:

```tsx
import { McpAppHostProvider } from '@mastra/playground-ui/domains/mcps';
import { observabilityWidgetPins } from '@mastra/mcp-apps-components/host';

const host = useMemo(
  () =>
    observabilityWidgetPins({
      resourceUri: 'ui://mastra/observability-widget',
      pinnedIds,
      onPin: ({ widget, datePreset, filters }) => savePin(widget, datePreset, filters),
      onUnpin: widgetId => removePin(widgetId),
    }),
  [pinnedIds],
);

<McpAppHostProvider value={host}>{chat}</McpAppHostProvider>;
```

A pin carries the widget, the date preset it was drawn over and, when the dashboard had any, its `defaults.filters`. The button only shows when the host sends pinned ids and accepts structured model context. A click shows right away and holds until the host sends new ids.

## Documentation

- [MCP Apps in Mastra](https://mastra.ai/docs/connections/mcp)
- [MCP Apps spec](https://github.com/modelcontextprotocol/ext-apps)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/mcp-apps-components/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
