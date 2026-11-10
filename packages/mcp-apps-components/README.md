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

`observabilityDashboardApp` draws a Studio dashboard (rows of KPIs, time series, tables and scores widgets) with the same components Studio uses. Each widget loads and fails on its own.

1. The model calls the tool that opens the app. That tool must declare an `outputSchema` so its result reaches the app as structured content: `{ dashboard, datePreset? }`, where `dashboard` passes `dashboardDefinitionSchema` from `@mastra/core/storage/dashboards` and `datePreset` is one of `24h`, `3d`, `7d`, `14d` or `30d`. Without `datePreset`, the app uses the dashboard's `defaults.datePreset` when it is one of those, else `24h`. The window ends when the app opens. The dashboard's top-level `defaults.filters` chips filter every widget.
2. The app reads its data through the app-only `queryObservability` tool (exported as `QUERY_OBSERVABILITY_TOOL`). It calls it once per read with `{ action, args, projectId? }`, where `action` is one of `OBSERVABILITY_READ_ACTIONS`, the `MastraClient` observability reads the app sends (`aggregateTraces`, `getMetricBreakdown`, `getScoreTimeSeries`, `listScores`, …), `args` are that method's arguments, with dates as ISO strings, and `projectId` is the project the host passed, if any (see [Drawing over the host page's selection](#drawing-over-the-host-pages-selection)). The tool returns `{ data }`, the method's result; if it throws, that widget shows as failed.

Use `observabilityDashboardInputSchema` as the opening tool's input and `toObservabilityDashboard` as its `execute`:

- The schema advertises every widget kind's options to the model, so the model can write its own widgets, and a wrong one fails input validation with errors the model can act on.
- The schema names the metrics Mastra records, but leaves metric names free: a name that doesn't exist reads as zero rather than failing. To make the model pick only metrics that have data, build the schema with `createObservabilityDashboardInputSchema({ metricNames })`, passing the names from `MastraClient#getMetricNames`. Unknown names are then rejected with the list of valid ones. Past `OBSERVABILITY_CATALOG_MAX_METRIC_NAMES` (200) names, or with none, they stay free. The schema is a snapshot, so rebuild the tool (`server.toolActions.add`) when the names change; `examples/agent` does this before each agent run.
- Label keys and values aren't listed. Give the model a tool that looks them up (for example with `MastraClient#getMetricLabelKeys` and `getMetricLabelValues`).
- Widgets without an `id` get a fresh UUID on every open, so the host can pin each one by an id that stays stable when the result is shown again.

The tools run on your server, so you decide which Mastra server the dashboard reads from and how it authenticates. Allow `OBSERVABILITY_READ_ACTIONS` and nothing else: a widget whose read is missing from the list fails.

```typescript
import { MastraClient } from '@mastra/client-js';
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import {
  OBSERVABILITY_READ_ACTIONS,
  QUERY_OBSERVABILITY_TOOL,
  observabilityDashboardApp,
  observabilityDashboardInputSchema,
  observabilityDashboardOutputSchema,
  toObservabilityDashboard,
} from '@mastra/mcp-apps-components';
import { z } from 'zod';

const uri = 'ui://mastra/observability-widget';
const client = new MastraClient({ baseUrl: process.env.MASTRA_URL! });
// Yours to write: checks the caller can access `projectId`, throws if not, and returns a client
// whose reads stay in that project.
declare function projectClient(projectId: string, context: unknown): Promise<MastraClient>;

export const observabilityServer = new MCPServer({
  id: 'observability',
  name: 'Observability',
  version: '1.0.0',
  appResources: { [uri]: observabilityDashboardApp },
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
      inputSchema: z.object({
        action: z.enum(OBSERVABILITY_READ_ACTIONS),
        args: z.record(z.string(), z.unknown()),
        projectId: z.string().optional(),
      }),
      outputSchema: z.object({ data: z.unknown() }),
      mcp: { _meta: { ui: { resourceUri: uri, visibility: ['app'] } } },
      execute: async ({ action, args, projectId }, context) => {
        const reader = projectId ? await projectClient(projectId, context) : client;
        const read = reader[action].bind(reader) as (args: unknown) => Promise<unknown>;
        return { data: await read(args) };
      },
    }),
  },
});
```

`projectId` comes from the app's iframe, so the server can't trust it: check that the caller can access that project before reading. A read that throws shows its widget as failed.

The input names each widget, read and column type by a key instead of a `kind`, `source` or `type` field, so a validation error points at the part that's wrong. Each number holds the read it comes from, so nothing points at a query by id:

```ts
{
  span: 6,
  timeseries: {
    chart: 'stackedBar',
    format: 'count',
    series: [{ label: 'Runs', color: 'green', value: { metricTimeSeries: { name: ['mastra_agent_duration_ms'], aggregation: 'count' } } }],
  },
}
```

`toObservabilityDashboard` gathers the reads into each view's queries, one per distinct read, and fills in what the stored definition points at: series keys, a chart's whole-range totals, a table's default sort.

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

A pin carries the widget, the date preset it was drawn over (with its `customRange` when `custom`) and, when it had any, the filters it was drawn under (the host's, else the dashboard's `defaults.filters`). The button only shows when the host sends pinned ids and accepts structured model context. A click shows right away and holds until the host sends new ids.

#### Drawing over the host page's selection

A host page with its own project, date range and filters, such as Studio's Metrics page, passes them down with `observabilityWidgetHost`. Pinning isn't needed for this:

```tsx
import { McpAppHostProvider } from '@mastra/playground-ui/domains/mcps';
import { observabilityWidgetHost } from '@mastra/mcp-apps-components/host';

const host = useMemo(
  () =>
    observabilityWidgetHost({
      resourceUri: 'ui://mastra/observability-widget',
      projectId,
      datePreset, // '24h' | '3d' | '7d' | '14d' | '30d' | 'custom'
      customRange, // { from?, to? } as Dates or ISO strings, drawn when datePreset is 'custom'
      filters, // FilterNode[], as a dashboard's defaults.filters
    }),
  [projectId, datePreset, customRange, filters],
);

<McpAppHostProvider value={host}>{chat}</McpAppHostProvider>;
```

`projectId` is sent with every `queryObservability` call, so your server can scope the reads to that project. It also sets the widgets' scope, as on the Metrics page: with a `projectId`, they show at project scope; without one, at org scope. Widgets, views and columns tagged for the other scope are hidden. The host's `datePreset` and `filters` replace the tool result's and the dashboard's defaults. The Metrics page's `datePreset`, `customRange` and `filterTokens` can be passed as they are. With `datePreset: 'custom'`, the widgets read over `customRange`, like the Metrics page: without `from`, the window starts 24 hours before now, and without `to`, it ends now. A value the app can't read (filters that fail the dashboard schema, an unknown preset, a range that ends before it starts) shows an error instead of the dashboard, so the widgets never draw data the host page didn't ask for. When any value changes, the app reads again; a preset window then ends at that moment. Each value is optional: leave one out to fall back to the dashboard's.

To let the user pin widgets too, add `pins: { pinnedIds, onPin, onUnpin }`. `observabilityWidgetPins` is the same helper with only pins.

### Validating stored dashboards

`dashboardDefinitionSchema` from `@mastra/core/storage/dashboards` checks a definition's structure and queries, but not what each widget kind needs. A definition can pass it and still show an error in place of a widget. To store only dashboards that draw, check every write with `strictDashboardDefinitionSchema` in the code that stores them:

```ts
import { strictDashboardDefinitionSchema } from '@mastra/mcp-apps-components/dashboards';
import type { StrictDashboardDefinition } from '@mastra/mcp-apps-components/dashboards';

const result = strictDashboardDefinitionSchema.safeParse(body.definition);
if (!result.success) {
  // Each issue has a path to the view, or into its options
  throw new BadRequestError(result.error.issues);
}
const definition: StrictDashboardDefinition = result.data;
```

On top of core's checks, the schema:

- Rejects widget kinds other than `kpis`, `table`, `timeseries` and `scores`.
- Checks each view's `options`, and each table column's `options`, against the kind's own schema.
- Rejects `columns` on views of widgets that aren't tables. The renderer ignores them, but they usually mean the widget was written as another kind.
- Runs each kind's checks, such as a KPI reading a query its view has, or a chart's series all fitting its buckets.
- Checks the widget at both `org` and `project` scope, so a widget that only breaks on one kind of page is rejected too.

Problems in a view's options point into them, such as `rows.0.widgets.1.views.0.options.series.0.value`. Problems a kind finds, such as a KPI reading a query its view doesn't have or two views with one label, point at the view, such as `rows.0.widgets.1.views.0`, with a message saying what's wrong, such as `options: reads query 'nope', which the view doesn't have`.

`result.data` is the definition you passed in, unchanged; store it as sent. Definitions that core has already parsed, with its defaults filled in, also pass. Use `strictDashboardWidgetSchema` to check a single widget, such as one being added or pinned; its issue paths start at the widget. Checks across widgets, such as unique ids and the widget limit, need the full definition.

Don't use these schemas in a request-body schema. Their input type is `unknown` and their JSON schema is empty, so a request type built from them would type `definition` as `unknown`, and generated API docs would describe it as anything. Keep core's `dashboardDefinitionSchema` there, and check with the strict schemas in the service before storing. Use `StrictDashboardDefinition` to type what you store and return.

Dashboards with custom widget kinds should keep using core's `dashboardDefinitionSchema`.

## Documentation

- [MCP Apps in Mastra](https://mastra.ai/docs/connections/mcp)
- [MCP Apps spec](https://github.com/modelcontextprotocol/ext-apps)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/mcp-apps-components/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
