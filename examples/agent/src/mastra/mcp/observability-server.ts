import { MastraClient } from '@mastra/client-js';
import { Agent } from '@mastra/core/agent';
import type { DashboardQuery, DashboardWidget } from '@mastra/core/storage/dashboards';
import { createTool } from '@mastra/core/tools';
import { MCPClient, MCPServer } from '@mastra/mcp';
import { QUERY_OBSERVABILITY_TOOL, observabilityWidgetApp } from '@mastra/mcp-apps-components';
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

const INPUT = 'mastra_model_total_input_tokens';
const OUTPUT = 'mastra_model_total_output_tokens';
const AGENT_DURATION = 'mastra_agent_duration_ms';
const FAILED = ['error', 'failed'];

const aggregate = (id: string, name: string[], aggregation: 'count' | 'sum'): DashboardQuery => ({
  id,
  source: 'metrics',
  request: 'aggregate',
  name,
  aggregation,
  compare: 'previousWindow',
});

const timeSeries = (id: string, name: string, aggregation: 'count' | 'sum', groupBy?: string[]): DashboardQuery => ({
  id,
  source: 'metrics',
  request: 'timeSeries',
  name: [name],
  aggregation,
  groupBy,
});

const WIDGETS = {
  overview: {
    id: 'overview',
    span: 12,
    kind: 'kpis',
    views: [
      {
        queries: [
          aggregate('runs', [AGENT_DURATION], 'count'),
          aggregate('cost', [INPUT, OUTPUT], 'sum'),
          aggregate('input', [INPUT], 'sum'),
          aggregate('output', [OUTPUT], 'sum'),
        ],
        options: {
          items: [
            { label: 'Agent runs', icon: 'bot', format: 'count', value: { query: 'runs' }, detail: 'in this range' },
            {
              label: 'Model cost',
              icon: 'coins',
              format: 'usd',
              value: { query: 'cost', field: 'estimatedCost' },
              detail: 'estimated',
              lowerIsBetter: true,
            },
            {
              label: 'Tokens',
              icon: 'hash',
              format: 'count',
              value: { sum: [{ query: 'input' }, { query: 'output' }] },
              detail: 'input and output',
            },
          ],
        },
      },
    ],
  },
  agentRuns: {
    id: 'agent-runs',
    span: 12,
    kind: 'timeseries',
    title: 'Agent runs',
    views: [
      {
        label: 'Agent runs',
        description: 'Completed and failed runs.',
        queries: [timeSeries('runs', AGENT_DURATION, 'count', ['status'])],
        options: {
          chart: 'stackedBar',
          format: 'count',
          xLabels: 'edges',
          series: [
            { dataKey: 'completed', label: 'Completed', color: 'green', value: { query: 'runs', notGroups: FAILED } },
            { dataKey: 'failed', label: 'Failed', color: 'error', value: { query: 'runs', groups: FAILED } },
          ],
          total: { value: 'total' },
          emptyMessage: 'No agent runs in this range.',
        },
      },
    ],
  },
  tokenUsage: {
    id: 'token-usage',
    span: 12,
    kind: 'timeseries',
    title: 'Token usage',
    views: [
      {
        label: 'Token usage',
        description: 'Input and output tokens.',
        queries: [timeSeries('input', INPUT, 'sum'), timeSeries('output', OUTPUT, 'sum')],
        options: {
          chart: 'stackedBar',
          format: 'count',
          xLabels: 'edges',
          series: [
            { dataKey: 'input', label: 'Input', color: 'green', value: { query: 'input' } },
            { dataKey: 'output', label: 'Output', color: 'sky', value: { query: 'output' } },
          ],
          total: { value: 'total' },
          emptyMessage: 'No model calls in this range.',
        },
      },
    ],
  },
  latency: {
    id: 'latency',
    span: 12,
    kind: 'timeseries',
    title: 'Agent latency',
    description: 'Duration percentiles.',
    views: [
      {
        label: 'Agent latency',
        queries: [
          { id: 'latency', source: 'metrics', request: 'percentiles', name: AGENT_DURATION, percentiles: [0.5, 0.95] },
        ],
        options: {
          chart: 'line',
          format: 'duration',
          buckets: 'api',
          xLabels: 'edges',
          series: [
            { dataKey: 'p50', label: 'P50', color: 'sky', value: { query: 'latency', percentile: 0.5 }, round: true },
            {
              dataKey: 'p95',
              label: 'P95',
              color: 'green',
              value: { query: 'latency', percentile: 0.95 },
              round: true,
            },
          ],
          emptyMessage: 'No agent runs in this range.',
        },
      },
    ],
  },
} satisfies Record<string, DashboardWidget>;

const DATE_PRESETS = ['24h', '3d', '7d', '14d', '30d'] as const;

// Visible to the model: opens the widget app. The app reads the widget and window from the result.
const showObservabilityWidget = createTool({
  id: 'showObservabilityWidget',
  description: 'Shows one observability chart for this Mastra project in the chat.',
  inputSchema: z.object({
    widget: z
      .enum(Object.keys(WIDGETS) as [keyof typeof WIDGETS])
      .describe(
        'overview: totals for agent runs, estimated model cost (spend) and tokens; agentRuns: completed vs failed runs over time; tokenUsage: input vs output tokens over time; latency: agent duration percentiles over time',
      ),
    datePreset: z.enum(DATE_PRESETS).default('24h').describe('How far back to look'),
  }),
  // Declaring the output schema makes the MCP server send the result as `structuredContent`.
  outputSchema: z.object({ widget: z.custom<DashboardWidget>(), datePreset: z.enum(DATE_PRESETS) }),
  mcp: { _meta: { ui: { resourceUri: OBSERVABILITY_WIDGET_URI } } },
  execute: async ({ widget, datePreset }) => ({ widget: WIDGETS[widget], datePreset }),
});

export const observabilityMcpServer = new MCPServer({
  id: OBSERVABILITY_SERVER_ID,
  name: 'Observability MCP Server',
  version: '1.0.0',
  appResources: { [OBSERVABILITY_WIDGET_URI]: observabilityWidgetApp },
  tools: { showObservabilityWidget, [QUERY_OBSERVABILITY_TOOL]: queryObservability },
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
  description: 'Shows observability charts for this project in the chat.',
  instructions: `When the user asks about agent runs, model cost, token usage or latency, call the observability widget tool
with the matching widget and time range. The chart renders in the chat with its own numbers, so don't repeat or guess
them: say in one short sentence what it shows.`,
  model: 'openai/gpt-5-mini',
  memory: new Memory(),
  tools: () => observabilityMcpClient.listTools(),
});
