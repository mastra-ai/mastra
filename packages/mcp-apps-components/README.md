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

### Observability widget

`observabilityWidgetApp` draws one Studio dashboard widget (KPIs, time series, table or scores) with the same components Studio uses.

1. The model calls the tool that opens the app. That tool must declare an `outputSchema` so its result reaches the app as structured content: `{ widget, datePreset? }`, where `widget` is a stored dashboard widget and `datePreset` is one of `24h` (default), `3d`, `7d`, `14d` or `30d`. The window ends when the app opens.
2. The app reads its data through the app-only `queryObservability` tool (exported as `QUERY_OBSERVABILITY_TOOL`). It calls it once per read with `{ action, args }`, where `action` is a `MastraClient` observability method (`getMetricAggregate`, `getMetricTimeSeries`, `listScores`, `aggregateTraces`, …) and `args` are that method's arguments, with dates as ISO strings. The tool returns `{ data }`, the method's result; if it throws, the widget shows as failed.

The tool runs on your server, so you decide which Mastra server the widget reads from and how it authenticates. Only allow read actions:

```typescript
import { MastraClient } from '@mastra/client-js';
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { QUERY_OBSERVABILITY_TOOL, observabilityWidgetApp } from '@mastra/mcp-apps-components';
import { z } from 'zod';

const uri = 'ui://mastra/observability-widget';
const client = new MastraClient({ baseUrl: process.env.MASTRA_URL! });
const ACTIONS = ['getMetricAggregate', 'getMetricTimeSeries'] as const;

export const observabilityServer = new MCPServer({
  id: 'observability',
  name: 'Observability',
  version: '1.0.0',
  appResources: { [uri]: observabilityWidgetApp },
  tools: {
    // Visible to the model: opens the app with a widget.
    showObservabilityWidget: createTool({
      id: 'showObservabilityWidget',
      description: 'Shows agent runs over time',
      inputSchema: z.object({ datePreset: z.enum(['24h', '3d', '7d', '14d', '30d']).default('24h') }),
      outputSchema: z.object({ widget: z.unknown(), datePreset: z.string() }),
      mcp: { _meta: { ui: { resourceUri: uri } } },
      execute: async ({ datePreset }) => ({ widget: agentRunsWidget, datePreset }),
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

`examples/agent` has a complete version with every read action, a set of preset widgets and an agent that opens them.

#### Pinning widgets

When the chat host supports it, the widget shows a pin button. The host owns the pinned widgets: it sends their ids to the app, and the app reports each pin and unpin through `ui/update-model-context`. In a host built on `@mastra/playground-ui`, pass `observabilityWidgetPins` from `@mastra/mcp-apps-components/host` to `McpAppHostProvider`:

```tsx
import { McpAppHostProvider } from '@mastra/playground-ui/domains/mcps';
import { observabilityWidgetPins } from '@mastra/mcp-apps-components/host';

const host = useMemo(
  () =>
    observabilityWidgetPins({
      resourceUri: 'ui://mastra/observability-widget',
      pinnedIds,
      onPin: ({ widget, datePreset }) => savePin(widget, datePreset),
      onUnpin: widgetId => removePin(widgetId),
    }),
  [pinnedIds],
);

<McpAppHostProvider value={host}>{chat}</McpAppHostProvider>;
```

The button only shows when the host sends pinned ids and accepts structured model context. A click shows right away and holds until the host sends new ids.

## Documentation

- [MCP Apps in Mastra](https://mastra.ai/docs/connections/mcp)
- [MCP Apps spec](https://github.com/modelcontextprotocol/ext-apps)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/mcp-apps-components/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
