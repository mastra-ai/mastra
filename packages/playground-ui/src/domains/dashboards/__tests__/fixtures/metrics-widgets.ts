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

// Runs report status `ok` or `error` (observability/mastra auto-extract); the card also counts `failed`.
const FAILED = ['error', 'failed'];
const completedRuns = { query: 0, notGroups: FAILED };
const failedRuns = { query: 0, groups: FAILED };
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
          {
            dataKey: 'input',
            label: 'Input',
            color: 'green',
            value: { max: [{ minus: [{ query: 0 }, { query: 2 }] }, { const: 0 }] },
          },
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
            value: {
              coalesce: [{ ratio: { of: failedRuns, over: { sum: [completedRuns, failedRuns] } } }, { const: 0 }],
            },
          },
        ],
        summary: {
          label: 'failed',
          value: {
            coalesce: [{ ratio: { of: failedRuns, over: { sum: [completedRuns, failedRuns] } } }, { const: 0 }],
          },
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

const USAGE = [INPUT, OUTPUT];
const TRACE_LIMIT = 1000;
const SPAN_LIMIT = 500;
const ERRORS = ['count', 'errorRate', 'duration.p95'] as const;
const hasThread = { op: 'exists', path: 'threadId' } as const;

const usageTotals = (groupBy: string[], filters?: Record<string, string>): DashboardQuery => ({
  source: 'metrics',
  request: 'breakdown',
  name: USAGE,
  groupBy,
  aggregation: 'sum',
  orderDirection: 'DESC',
  limit: 1000,
  ...(filters ? { filters } : {}),
  compare: 'previousWindow',
});

/** Count, errors and P95 from query 0; tokens and cost from query 1. */
const figureColumns = (count: { label: string; measure: string; unit: 'traces' | 'spans' }, usage: boolean) => [
  { id: 'errorRate', options: { query: 0, measure: 'errorRate' } },
  { id: 'p95', options: { query: 0, measure: 'duration.p95' } },
  ...(usage
    ? [
        { id: 'tokens', options: { query: 1, field: 'value' } },
        { id: 'cost', options: { query: 1, field: 'estimatedCost' } },
      ]
    : []),
  { id: 'count', label: count.label, options: { query: 0, measure: count.measure, unit: count.unit } },
];

const project = { id: 'project', scope: 'org' } as const;
const scoped = (scope: 'org' | 'project', dimension: string) =>
  scope === 'org' ? ['projectId', dimension] : [dimension];

const entityView = (
  scope: 'org' | 'project',
  label: string,
  spanTypes: string[],
  description: string,
  emptyMessage: string,
) => {
  const groupBy = scoped(scope, 'entityName');
  const agents = label === 'Agents';
  const usage = agents;
  const traces = agents || label === 'Workflows';
  return {
    label,
    scope,
    description,
    queries: [
      {
        source: 'spanAggregate',
        where:
          spanTypes.length === 1
            ? { op: 'eq', left: { path: 'spanType' }, right: { literal: spanTypes[0] } }
            : { op: 'in', value: { path: 'spanType' }, set: spanTypes },
        groupBy,
        measures: ['count', ...(traces ? ['countDistinct.traceId'] : []), 'errorCount', 'errorRate', 'duration.p95'],
        limit: SPAN_LIMIT,
        compare: 'previousWindow',
      },
      ...(usage ? [usageTotals(groupBy, { entityType: 'agent' })] : []),
    ],
    columns: [
      ...(scope === 'org' ? [project] : []),
      ...figureColumns(
        traces
          ? { label: 'Traces', measure: 'countDistinct.traceId', unit: 'traces' }
          : { label: 'Spans', measure: 'count', unit: 'spans' },
        usage,
      ),
    ],
    options: { groupBy, rowScope: { spanTypes }, emptyMessage },
  };
};

const traceColumns = (scope: 'org' | 'project') => [
  ...(scope === 'org' ? [project] : []),
  ...figureColumns({ label: 'Traces', measure: 'count', unit: 'traces' }, true),
];

const environmentsView = (scope: 'org' | 'project') => {
  const groupBy = scoped(scope, 'environment');
  return {
    label: 'Environments',
    scope,
    description: 'Traces, errors, latency and spend per environment.',
    queries: [
      { source: 'traceAggregate', groupBy, measures: ERRORS, limit: TRACE_LIMIT, compare: 'previousWindow' },
      usageTotals(groupBy),
    ],
    columns: traceColumns(scope),
    options: {
      groupBy,
      unnamed: 'No environment',
      rowScope: { field: 'environment' },
      emptyMessage: 'No traces in this range.',
    },
  };
};

const threadsView = (scope: 'org' | 'project') => {
  const groupBy = scoped(scope, 'threadId');
  const threads = {
    source: 'traceAggregate',
    where: hasThread,
    groupBy: scope === 'org' ? ['projectId', 'threadId'] : ['resourceId', 'threadId'],
    measures: ERRORS,
    limit: TRACE_LIMIT,
    compare: 'previousWindow',
  };
  // Org-wide the second dimension is the project, so a third request names each thread's resource.
  const resources = {
    source: 'traceAggregate',
    where: hasThread,
    groupBy: ['resourceId', 'threadId'],
    measures: ['count'],
    limit: TRACE_LIMIT,
  };
  return {
    label: 'Threads',
    scope,
    description: 'Traces, errors, latency and spend per thread.',
    queries: [threads, usageTotals(groupBy), ...(scope === 'org' ? [resources] : [])],
    columns: [
      ...traceColumns(scope),
      {
        id: 'resource',
        options: { query: scope === 'org' ? 2 : 0, dimension: 'resourceId', joinOn: 'threadId' },
      },
    ],
    options: {
      groupBy,
      hideUnnamed: true,
      dropped: false,
      rowScope: { field: 'threadId', keepEmpty: true },
      emptyMessage: 'No traces with a thread in this range.',
    },
  };
};

const modelsView = (scope: 'org' | 'project') => {
  const groupBy = scoped(scope, 'model');
  return {
    label: 'Models',
    scope,
    description: 'Model calls, tokens and spend per model.',
    queries: [
      usageTotals(groupBy),
      {
        source: 'metrics',
        request: 'breakdown',
        name: [INPUT],
        groupBy,
        aggregation: 'count',
        orderDirection: 'DESC',
        limit: 1000,
        compare: 'previousWindow',
      },
    ],
    columns: [
      ...(scope === 'org' ? [project] : []),
      { id: 'tokens', options: { query: 0, field: 'value' } },
      { id: 'cost', options: { query: 0, field: 'estimatedCost' } },
      { id: 'count', label: 'Spans', options: { query: 1, field: 'value', unit: 'spans' } },
    ],
    options: {
      groupBy,
      unnamed: 'Unknown model',
      rowScope: { field: 'model' },
      emptyMessage: 'No model usage in this range.',
    },
  };
};

const scopedViews = (scope: 'org' | 'project') => [
  entityView(
    scope,
    'Agents',
    ['agent_run'],
    'Traces each agent ran in, nested runs included, with errors, latency and spend.',
    'No agent runs in this range.',
  ),
  entityView(
    scope,
    'Workflows',
    ['workflow_run'],
    'Traces each workflow ran in, nested runs included, with errors and latency.',
    'No workflow runs in this range.',
  ),
  entityView(
    scope,
    'Tools',
    ['tool_call', 'mcp_tool_call'],
    'Every tool call, MCP tools included, with errors and latency.',
    'No tool calls in this range.',
  ),
  modelsView(scope),
  threadsView(scope),
  environmentsView(scope),
];

export const breakdownWidget = {
  id: 'breakdown',
  span: 12,
  kind: 'breakdown',
  title: 'Breakdown',
  drilldown: { click: { page: 'traces' } },
  views: [
    {
      label: 'Projects',
      scope: 'org',
      description: 'Traces, errors, latency and spend per project.',
      queries: [
        {
          source: 'traceAggregate',
          groupBy: ['projectId'],
          measures: [...ERRORS, 'countDistinct.resourceId', 'countDistinct.threadId'],
          limit: TRACE_LIMIT,
          compare: 'previousWindow',
        },
        usageTotals(['projectId']),
      ],
      columns: figureColumns({ label: 'Traces', measure: 'count', unit: 'traces' }, true),
      options: {
        groupBy: ['projectId'],
        rowLabel: 'project',
        emptyMessage: 'No traces in this range.',
        openWhen: 'twoOrMoreRows',
      },
    },
    ...scopedViews('org'),
    ...scopedViews('project'),
  ],
} as DashboardWidget;
