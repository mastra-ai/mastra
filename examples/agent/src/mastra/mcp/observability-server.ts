import { MastraClient } from '@mastra/client-js';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { MCPClient, MCPServer } from '@mastra/mcp';
import {
  OBSERVABILITY_CATALOG_MAX_METRIC_NAMES,
  OBSERVABILITY_READ_ACTIONS,
  QUERY_OBSERVABILITY_TOOL,
  createObservabilityDashboardInputSchema,
  observabilityDashboardApp,
  observabilityDashboardOutputSchema,
  toObservabilityDashboard,
} from '@mastra/mcp-apps-components';
import { Memory } from '@mastra/memory';
import { z } from 'zod';

const OBSERVABILITY_SERVER_ID = 'observability-mcp-server';
const OBSERVABILITY_WIDGET_URI = 'ui://mastra/observability-widget';
// This Mastra server, which the agent reaches over HTTP like any MCP client.
const MASTRA_SERVER_URL = process.env.MASTRA_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4111}`;
// The Mastra server whose observability the widget shows. Point it at a deployed server (with a
// token if it requires auth) to chart production data from a local agent.
const OBSERVABILITY_API_URL = process.env.OBSERVABILITY_API_URL ?? MASTRA_SERVER_URL;
const OBSERVABILITY_API_TOKEN = process.env.OBSERVABILITY_API_TOKEN;
// Server-side client for the observability API. The widget never sees this URL or token.
const observabilityClient = new MastraClient({
  baseUrl: OBSERVABILITY_API_URL,
  headers: OBSERVABILITY_API_TOKEN ? { authorization: `Bearer ${OBSERVABILITY_API_TOKEN}` } : undefined,
});

// Visible to the app only: the widget asks for each read by action, and the server runs it on its
// own client. A failed read throws, so the app shows the widget as failed.
const queryObservability = createTool({
  id: QUERY_OBSERVABILITY_TOOL,
  description: 'Runs one observability read for the observability widget.',
  // The read-only client methods the widget asks for. Anything else fails input validation.
  inputSchema: z.object({ action: z.enum(OBSERVABILITY_READ_ACTIONS), args: z.record(z.string(), z.unknown()) }),
  outputSchema: z.object({ data: z.unknown() }),
  mcp: { _meta: { ui: { resourceUri: OBSERVABILITY_WIDGET_URI, visibility: ['app'] } } },
  execute: async ({ action, args }) => {
    // The args arrive as JSON from the iframe; the observability route validates them.
    const read = observabilityClient[action].bind(observabilityClient) as (args: unknown) => Promise<unknown>;
    return { data: await read(args) };
  },
});

// Visible to the model: lists what the project records, so the dashboard queries name metrics,
// labels and filter values that exist. An unknown metric name reads as zero rather than failing.
const discoverObservability = createTool({
  id: 'discoverObservability',
  description: `Lists what this project's observability records, to use in dashboard queries and filters.
metricNames: every metric name. labelKeys: the labels on \`metricName\`, to group or filter by. labelValues: the values
of \`labelKey\` on \`metricName\`. entityNames: the agents, workflows and tools that ran. environments, tags: values to
filter by.`,
  inputSchema: z.object({
    list: z.enum(['metricNames', 'labelKeys', 'labelValues', 'entityNames', 'environments', 'tags']),
    metricName: z.string().optional().describe('Required for labelKeys and labelValues.'),
    labelKey: z.string().optional().describe('Required for labelValues.'),
  }),
  execute: async ({ list, metricName, labelKey }) => {
    switch (list) {
      case 'metricNames':
        return observabilityClient.getMetricNames();
      case 'labelKeys':
        if (!metricName) throw new Error('labelKeys needs a metricName');
        return observabilityClient.getMetricLabelKeys({ metricName });
      case 'labelValues':
        if (!metricName || !labelKey) throw new Error('labelValues needs a metricName and a labelKey');
        return observabilityClient.getMetricLabelValues({ metricName, labelKey });
      case 'entityNames':
        return observabilityClient.getEntityNames();
      case 'environments':
        return observabilityClient.getEnvironments();
      case 'tags':
        return observabilityClient.getTags();
    }
  },
});

// Visible to the model: opens the dashboard app. The model writes the widgets; the input schema
// advertises every widget kind's options and the metric names that have data, so a bad dashboard
// fails with errors the model can fix. Widgets without an id get a fresh one, which the host pins by.
const showObservabilityDashboard = (metricNames: readonly string[]) =>
  createTool({
    id: 'showObservabilityDashboard',
    description: `Shows an observability dashboard for this Mastra project in the chat. Each row holds widgets on a
12-column grid and is a kpis, timeseries, table or scores widget.`,
    inputSchema: createObservabilityDashboardInputSchema({ metricNames }),
    // Declaring the output schema makes the MCP server send the result as `structuredContent`.
    outputSchema: observabilityDashboardOutputSchema,
    mcp: { _meta: { ui: { resourceUri: OBSERVABILITY_WIDGET_URI } } },
    execute: async input => toObservabilityDashboard(input),
  });

export const observabilityMcpServer = new MCPServer({
  id: OBSERVABILITY_SERVER_ID,
  name: 'Observability MCP Server',
  version: '1.0.0',
  appResources: { [OBSERVABILITY_WIDGET_URI]: observabilityDashboardApp },
  tools: {
    discoverObservability,
    // Free metric names until the first run reads the catalog.
    showObservabilityDashboard: showObservabilityDashboard([]),
    [QUERY_OBSERVABILITY_TOOL]: queryObservability,
  },
});

// The server key matches the server id so Studio maps the namespaced tool back to its ui:// app.
const observabilityMcpClient = new MCPClient({
  id: 'observability-mcp-client',
  servers: {
    [OBSERVABILITY_SERVER_ID]: { url: new URL(`/api/mcp/${OBSERVABILITY_SERVER_ID}/mcp`, MASTRA_SERVER_URL) },
  },
});

// The schema is a snapshot of the catalog, so the tool is rebuilt when the metric names change.
// Reading them at startup would ask this server before it listens, so each agent run reads them.
let listedMetricNames: string | undefined;
async function refreshDashboardTool() {
  const { names } = await observabilityClient.getMetricNames({ limit: OBSERVABILITY_CATALOG_MAX_METRIC_NAMES + 1 });
  const key = [...names].sort().join('\n');
  if (key === listedMetricNames) return;
  await observabilityMcpServer.toolActions.add({ showObservabilityDashboard: showObservabilityDashboard(names) });
  listedMetricNames = key;
}

export const observabilityAgent = new Agent({
  id: 'observability-agent',
  name: 'Observability Agent',
  description: 'Shows observability dashboards for this project in the chat.',
  instructions: `When the user asks about agent runs, model cost, token usage, latency or scores, call the observability
dashboard tool with the widgets that answer it and the matching time range. Before naming a metric, label or filter
value you're not sure exists, check it with the discovery tool. The dashboard renders in the chat with its own numbers, so don't repeat or guess them: say in one
short sentence what it shows.`,
  model: 'openai/gpt-5-mini',
  memory: new Memory(),
  tools: async () => {
    // Unreachable, the tool keeps the names it last listed.
    await refreshDashboardTool().catch(() => undefined);
    return observabilityMcpClient.listTools();
  },
});
