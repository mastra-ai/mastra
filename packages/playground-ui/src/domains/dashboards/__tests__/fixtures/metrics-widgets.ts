import type { DashboardQuery, DashboardWidget } from '@mastra/client-js';

/**
 * Widgets describing today's Metrics cards, one per card. The request- and DOM-equality tests render
 * each next to its card; they're the seed of `METRICS_DASHBOARD`.
 */

const INPUT = 'mastra_model_total_input_tokens';
const OUTPUT = 'mastra_model_total_output_tokens';
const CACHE_READ = 'mastra_model_input_cache_read_tokens';
const AGENT_DURATION = 'mastra_agent_duration_ms';

const sumSeries = (name: string): DashboardQuery => ({
  source: 'metrics',
  request: 'timeSeries',
  name: [name],
  aggregation: 'sum',
});

const agentRunsByStatus: DashboardQuery = {
  source: 'metrics',
  request: 'timeSeries',
  name: [AGENT_DURATION],
  aggregation: 'count',
  groupBy: ['status'],
};

const FAILED = ['error', 'fail'];
const completedRuns = { query: 0, groupsExcluding: FAILED };
const failedRuns = { query: 0, groupsIncluding: FAILED };
const agentRunsTraces = { page: 'traces', filters: [{ fieldId: 'rootEntityType', value: 'agent' }] } as const;

export const kpisWidget: DashboardWidget = {
  id: 'kpis',
  span: 12,
  kind: 'kpis',
  views: [
    {
      queries: [
        {
          source: 'metrics',
          request: 'aggregate',
          name: [AGENT_DURATION],
          aggregation: 'count',
          compare: 'previousWindow',
        },
        {
          source: 'metrics',
          request: 'aggregate',
          name: [INPUT, OUTPUT],
          aggregation: 'sum',
          compare: 'previousWindow',
        },
        { source: 'metrics', request: 'aggregate', name: [INPUT], aggregation: 'sum', compare: 'previousWindow' },
        { source: 'metrics', request: 'aggregate', name: [OUTPUT], aggregation: 'sum', compare: 'previousWindow' },
        {
          source: 'metrics',
          request: 'aggregate',
          name: [AGENT_DURATION],
          aggregation: 'count_distinct',
          distinctColumn: 'threadId',
          compare: 'previousWindow',
        },
      ],
      options: {
        items: [
          { label: 'Agent runs', icon: 'bot', format: 'count', value: { query: 0 }, detail: 'in this range' },
          {
            label: 'Model cost',
            icon: 'coins',
            format: 'usd',
            value: { query: 1, field: 'estimatedCost' },
            detail: 'estimated',
            lowerIsBetter: true,
          },
          {
            label: 'Tokens',
            icon: 'hash',
            format: 'count',
            value: { sum: [{ query: 2 }, { query: 3 }] },
            detail: 'input and output',
          },
          { label: 'Threads', icon: 'threads', format: 'count', value: { query: 4 }, detail: 'with agent runs' },
        ],
      },
    },
  ],
};

export const tokenUsageWidget: DashboardWidget = {
  id: 'token-usage',
  span: 12,
  kind: 'timeseries',
  title: 'Token usage',
  drilldown: { action: { page: 'traces' }, click: { page: 'traces' } },
  views: [
    {
      label: 'Tokens',
      description: 'Input, cache reads and output.',
      queries: [sumSeries(INPUT), sumSeries(OUTPUT), sumSeries(CACHE_READ)],
      options: {
        chart: 'stackedBar',
        format: 'count',
        series: [
          { dataKey: 'input', label: 'Input', color: 'green', value: { minus: [{ query: 0 }, { query: 2 }] } },
          { dataKey: 'cacheRead', label: 'Cache read', color: 'violet', value: { query: 2 } },
          { dataKey: 'output', label: 'Output', color: 'sky', value: { query: 1 } },
        ],
        summary: { label: 'tokens', value: 'total' },
        emptyMessage: 'No model calls in this range.',
      },
    },
    {
      label: 'Cost',
      description: 'Estimated model spend.',
      queries: [sumSeries(INPUT), sumSeries(OUTPUT)],
      options: {
        chart: 'stackedBar',
        format: 'usd',
        series: [
          {
            dataKey: 'cost',
            label: 'Cost',
            color: 'green',
            value: {
              sum: [
                { query: 0, field: 'estimatedCost' },
                { query: 1, field: 'estimatedCost' },
              ],
            },
          },
        ],
        summary: { label: 'cost', value: 'total' },
        emptyMessage: 'No model calls in this range.',
      },
    },
  ],
};

export const agentRunsWidget: DashboardWidget = {
  id: 'agent-runs',
  span: 6,
  kind: 'timeseries',
  title: 'Agent runs',
  description: 'Completed and failed runs.',
  drilldown: { click: agentRunsTraces },
  views: [
    {
      queries: [agentRunsByStatus],
      options: {
        chart: 'stackedBar',
        format: 'count',
        axis: false,
        xLabels: 'edges',
        series: [
          { dataKey: 'completed', label: 'Completed', color: 'green', value: completedRuns },
          { dataKey: 'failed', label: 'Failed', color: 'error', value: failedRuns },
        ],
        summary: { label: 'runs', value: 'total' },
        emptyMessage: 'No agent runs in this range.',
      },
    },
  ],
};

export const failureRateWidget: DashboardWidget = {
  id: 'failure-rate',
  span: 6,
  kind: 'timeseries',
  title: 'Failure rate',
  description: 'Share of agent runs that failed.',
  drilldown: {
    action: {
      page: 'logs',
      filters: [
        { fieldId: 'rootEntityType', value: 'agent' },
        { fieldId: 'status', value: 'error' },
      ],
    },
    click: {
      page: 'traces',
      filters: [
        { fieldId: 'rootEntityType', value: 'agent' },
        { fieldId: 'status', value: 'error' },
      ],
    },
  },
  views: [
    {
      queries: [agentRunsByStatus],
      options: {
        chart: 'line',
        format: 'percent',
        xLabels: 'edges',
        flatYDomain: [0, 1],
        series: [
          {
            dataKey: 'failureRate',
            label: 'Failed runs',
            color: 'error',
            value: { ratio: { of: failedRuns, over: { sum: [completedRuns, failedRuns] } } },
          },
        ],
        summary: {
          label: 'failed',
          value: { ratio: { of: failedRuns, over: { sum: [completedRuns, failedRuns] } } },
        },
        emptyWhenZero: { sum: [completedRuns, failedRuns] },
        emptyMessage: 'No agent runs in this range.',
      },
    },
  ],
};

const latencyView = (label: string, metric: string, rootEntityType: string, noun: string) => ({
  label,
  queries: [
    {
      source: 'metrics',
      request: 'percentiles',
      name: metric,
      percentiles: [0.5, 0.95, 0.99],
    } satisfies DashboardQuery,
  ],
  drilldown: { action: { page: 'traces', filters: [{ fieldId: 'rootEntityType', value: rootEntityType }] } } as const,
  options: {
    chart: 'line',
    format: 'duration',
    buckets: 'api',
    xLabels: 'edges',
    series: [
      { dataKey: 'p50', label: 'P50', color: 'sky', value: { query: 0, percentile: 0.5 }, round: true },
      {
        dataKey: 'p95',
        label: 'P95',
        color: 'green',
        emphasis: true,
        value: { query: 0, percentile: 0.95 },
        round: true,
      },
      { dataKey: 'p99', label: 'P99', color: 'violet', value: { query: 0, percentile: 0.99 }, round: true },
    ],
    summary: { label: 'peak P95', value: { peak: 'p95' } },
    emptyMessage: `No ${noun} in this range.`,
  },
});

export const latencyWidget: DashboardWidget = {
  id: 'latency',
  span: 6,
  kind: 'timeseries',
  title: 'Latency',
  description: 'Duration percentiles.',
  drilldown: { click: { page: 'traces' } },
  views: [
    latencyView('Agents', 'mastra_agent_duration_ms', 'agent', 'agent runs'),
    latencyView('Workflows', 'mastra_workflow_duration_ms', 'workflow_run', 'workflow runs'),
    latencyView('Tools', 'mastra_tool_duration_ms', 'tool', 'tool calls'),
  ],
};

const DISTINCT_IDS = [
  ['countDistinct.resourceId', 'resources', 'Resources', 'sky'],
  ['countDistinct.threadId', 'threads', 'Threads', 'green'],
  ['countDistinct.userId', 'users', 'Users', 'violet'],
  ['countDistinct.sessionId', 'sessions', 'Sessions', 'teal'],
] as const;
const distinctMeasures = DISTINCT_IDS.map(([measure]) => measure);

export const distinctIdsWidget: DashboardWidget = {
  id: 'distinct-ids',
  span: 6,
  kind: 'timeseries',
  title: 'Resources and threads',
  description: 'Unique ids on traces; users and sessions only when set.',
  drilldown: { click: { page: 'traces' } },
  views: [
    {
      queries: [
        { source: 'traceAggregate', measures: distinctMeasures, limit: 10 },
        { source: 'traceAggregate', measures: distinctMeasures },
      ],
      options: {
        chart: 'line',
        format: 'count',
        xLabels: 'edges',
        totals: [1],
        hideEmpty: true,
        emphasizeFirst: true,
        series: DISTINCT_IDS.map(([measure, dataKey, label, color]) => ({
          dataKey,
          label,
          color,
          value: { query: 0, measure },
          legendValue: { query: 1, measure },
        })),
        emptyMessage: 'No traces in this range set a resource, thread, user or session id.',
      },
    },
  ],
};

export const scoresWidget: DashboardWidget = {
  id: 'scores',
  span: 12,
  kind: 'scores',
  title: 'Scores',
  description: 'Average scorer result, 0 to 1.',
  views: [
    {
      queries: [
        { source: 'scores', request: 'aggregate', aggregation: 'avg' },
        { source: 'scores', request: 'timeSeries', aggregation: 'avg' },
      ],
      options: { average: 0, series: 1, emptyMessage: 'No scores in this range.' },
    },
  ],
};
