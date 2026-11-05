import { dashboardDefaultsSchema } from '@mastra/core/storage/dashboards';
import type {
  DashboardDefinition,
  DashboardQuery,
  DashboardRow,
  DashboardWidget,
} from '@mastra/core/storage/dashboards';
import type { McpAppTool } from '@mastra/mcp-apps-components';
import type { dashboardUi } from '@mastra/mcp-apps-components/dashboard-renderer';
import { timeseriesOptionsSchema } from '@mastra/playground-ui/domains/dashboards/lib/timeseries';
import type { TimeseriesOptions } from '@mastra/playground-ui/domains/dashboards/lib/timeseries';
import { z } from 'zod';

const INPUT = 'mastra_model_total_input_tokens';
const OUTPUT = 'mastra_model_total_output_tokens';
const AGENT_DURATION = 'mastra_agent_duration_ms';

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

const FAILED = ['error', 'failed'];

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
    span: 6,
    kind: 'timeseries',
    title: 'Agent runs',
    // Opens the agent traces from the chart; in a chat host this asks the agent for them.
    drilldown: { action: { page: 'traces', filters: [{ fieldId: 'rootEntityType', value: 'agent' }] } },
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
    span: 6,
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
          total: { value: { peak: 'p95' } },
          emptyMessage: 'No agent runs in this range.',
        },
      },
    ],
  },
} satisfies Record<string, DashboardWidget>;

const SECTIONS = ['overview', 'agentRuns', 'tokenUsage', 'latency'] as const;
// Latency plots percentiles, which can't stack, so it stays a line.
const CHART_SECTIONS: ReadonlySet<(typeof SECTIONS)[number]> = new Set(['agentRuns', 'tokenUsage']);

function withChart(widget: DashboardWidget, chart: TimeseriesOptions['chart']): DashboardWidget {
  return { ...widget, views: widget.views.map(view => ({ ...view, options: { ...view.options, chart } })) };
}

// Half-width widgets pair up on a row; a widget left alone on its row takes the full width.
function layout(widgets: DashboardWidget[]): DashboardRow[] {
  const rows: DashboardWidget[][] = [];
  for (const widget of widgets) {
    const last = rows.at(-1);
    const lastSpan = last?.reduce((total, w) => total + w.span, 0) ?? 12;
    if (last && lastSpan + widget.span <= 12) last.push(widget);
    else rows.push([widget]);
  }
  return rows.map(row => ({ widgets: row.length === 1 ? [{ ...row[0]!, span: 12 }] : row }));
}

const inputSchema = z.object({
  sections: z
    .array(z.enum(SECTIONS))
    .min(1)
    .describe(
      'Only the parts the user asked about: overview KPIs, agent runs over time, token usage over time, agent latency.',
    ),
  datePreset: dashboardDefaultsSchema.shape.datePreset.describe('Initial time range, e.g. 24h, 7d or 30d.'),
  chart: timeseriesOptionsSchema.shape.chart
    .optional()
    .describe(
      'Chart type for agent runs and token usage. Defaults to stacked bars. Latency is always a line. No other chart types exist.',
    ),
});

// The tool the model calls to open the dashboard: it turns the sections asked for into the dashboard's input.
export const showObservabilityDashboard: McpAppTool<typeof inputSchema, typeof dashboardUi.input> = {
  id: 'showObservabilityDashboard',
  description:
    'Shows a live observability dashboard (agent runs, model cost, tokens, latency) for this Mastra server, rendered as an interactive UI in the chat.',
  inputSchema,
  execute: async ({ sections, datePreset, chart }) => {
    const widgets = sections.map(section =>
      chart && CHART_SECTIONS.has(section) ? withChart(WIDGETS[section], chart) : WIDGETS[section],
    );
    const definition: DashboardDefinition = { schemaVersion: 1, defaults: { datePreset }, rows: layout(widgets) };
    return { definition, scope: 'project' };
  },
};
