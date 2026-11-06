import { MastraClient } from '@mastra/client-js';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { MCPClient, MCPServer } from '@mastra/mcp';
import {
  QUERY_OBSERVABILITY_TOOL,
  observabilityDashboardInputSchema,
  observabilityDashboardOutputSchema,
  observabilityWidgetApp,
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

// The read-only client methods the widget may ask for. Anything else fails input validation.
const ACTIONS = [
  'aggregateTraces',
  'aggregateSpans',
  'getMetricAggregate',
  'getMetricBreakdown',
  'getMetricTimeSeries',
  'getMetricPercentiles',
  'getScoreAggregate',
  'getScoreBreakdown',
  'getScoreTimeSeries',
  'getScorePercentiles',
  'listScores',
] as const satisfies readonly (keyof MastraClient)[];

// Visible to the app only: the widget asks for each read by action, and the server runs it on its
// own client. A failed read throws, so the app shows the widget as failed.
const queryObservability = createTool({
  id: QUERY_OBSERVABILITY_TOOL,
  description: 'Runs one observability read for the observability widget.',
  inputSchema: z.object({ action: z.enum(ACTIONS), args: z.record(z.string(), z.unknown()) }),
  outputSchema: z.object({ data: z.unknown() }),
  mcp: { _meta: { ui: { resourceUri: OBSERVABILITY_WIDGET_URI, visibility: ['app'] } } },
  execute: async ({ action, args }) => {
    // The args arrive as JSON from the iframe; the observability route validates them.
    const read = observabilityClient[action].bind(observabilityClient) as (args: unknown) => Promise<unknown>;
    return { data: await read(args) };
  },
});

// Visible to the model: opens the dashboard app. The model writes the widgets; the input schema advertises every widget kind's options, so a bad dashboard fails with
// errors the model can fix. Widgets without an id get a fresh one, which the host pins by.
const showObservabilityDashboard = createTool({
  id: 'showObservabilityDashboard',
  description: `Shows an observability dashboard for this Mastra project in the chat. Each row holds widgets on a
12-column grid and is a kpis, timeseries, table or scores widget.`,
  inputSchema: observabilityDashboardInputSchema,
  // Declaring the output schema makes the MCP server send the result as `structuredContent`.
  outputSchema: observabilityDashboardOutputSchema,
  mcp: { _meta: { ui: { resourceUri: OBSERVABILITY_WIDGET_URI } } },
  execute: async input => toObservabilityDashboard(input),
});

export const observabilityMcpServer = new MCPServer({
  id: OBSERVABILITY_SERVER_ID,
  name: 'Observability MCP Server',
  version: '1.0.0',
  appResources: { [OBSERVABILITY_WIDGET_URI]: observabilityWidgetApp },
  tools: { showObservabilityDashboard, [QUERY_OBSERVABILITY_TOOL]: queryObservability },
});

// The server key matches the server id so Studio maps the namespaced tool back to its ui:// app.
const observabilityMcpClient = new MCPClient({
  id: 'observability-mcp-client',
  servers: {
    [OBSERVABILITY_SERVER_ID]: { url: new URL(`/api/mcp/${OBSERVABILITY_SERVER_ID}/mcp`, MASTRA_SERVER_URL) },
  },
});

export const observabilityAgent = new Agent({
  id: 'observability-agent',
  name: 'Observability Agent',
  description: 'Shows observability dashboards for this project in the chat.',
  instructions: `When the user asks about agent runs, model cost, token usage, latency or scores, call the observability
dashboard tool with the widgets that answer it and the matching time range. The dashboard renders in the chat with its own numbers, so don't repeat or guess them: say in one
short sentence what it shows.`,
  model: 'openai/gpt-5-mini',
  memory: new Memory(),
  tools: () => observabilityMcpClient.listTools(),
});
