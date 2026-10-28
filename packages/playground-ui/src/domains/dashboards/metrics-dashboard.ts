import type {
  DashboardColumn,
  DashboardDefinition,
  DashboardDrilldownTarget,
  DashboardQuery,
  DashboardWidget,
  DashboardWidgetView,
} from '@mastra/client-js';

const INPUT = 'mastra_model_total_input_tokens';
const OUTPUT = 'mastra_model_total_output_tokens';
const CACHE_READ = 'mastra_model_input_cache_read_tokens';
const AGENT_DURATION = 'mastra_agent_duration_ms';

const sumSeries = (id: string, name: string): DashboardQuery => ({
  id,
  source: 'metrics',
  request: 'timeSeries',
  name: [name],
  aggregation: 'sum',
});

const agentRunsByStatus: DashboardQuery = {
  id: 'runs',
  source: 'metrics',
  request: 'timeSeries',
  name: [AGENT_DURATION],
  aggregation: 'count',
  groupBy: ['status'],
};

// Runs report status `ok` or `error` (observability/mastra auto-extract); the card also counts `failed`.
const FAILED = ['error', 'failed'];
const completedRuns = { query: 'runs', notGroups: FAILED };
const failedRuns = { query: 'runs', groups: FAILED };
const agentRunsTraces: DashboardDrilldownTarget = {
  page: 'traces',
  filters: [{ fieldId: 'rootEntityType', value: 'agent' }],
};

const kpisWidget: DashboardWidget = {
  id: 'kpis',
  span: 12,
  kind: 'kpis',
  views: [
    {
      queries: [
        {
          id: 'runs',
          source: 'metrics',
          request: 'aggregate',
          name: [AGENT_DURATION],
          aggregation: 'count',
          compare: 'previousWindow',
        },
        {
          id: 'cost',
          source: 'metrics',
          request: 'aggregate',
          name: [INPUT, OUTPUT],
          aggregation: 'sum',
          compare: 'previousWindow',
        },
        {
          id: 'input',
          source: 'metrics',
          request: 'aggregate',
          name: [INPUT],
          aggregation: 'sum',
          compare: 'previousWindow',
        },
        {
          id: 'output',
          source: 'metrics',
          request: 'aggregate',
          name: [OUTPUT],
          aggregation: 'sum',
          compare: 'previousWindow',
        },
        {
          id: 'threads',
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
          {
            label: 'Threads',
            icon: 'threads',
            format: 'count',
            value: { query: 'threads' },
            detail: 'with agent runs',
          },
        ],
      },
    },
  ],
};

const tokenUsageWidget: DashboardWidget = {
  id: 'token-usage',
  span: 12,
  kind: 'timeseries',
  title: 'Token usage',
  drilldown: { action: { page: 'traces' }, click: { page: 'traces' } },
  views: [
    {
      label: 'Tokens',
      description: 'Input, cache reads and output.',
      queries: [sumSeries('input', INPUT), sumSeries('output', OUTPUT), sumSeries('cacheRead', CACHE_READ)],
      options: {
        chart: 'stackedBar',
        format: 'count',
        series: [
          {
            dataKey: 'input',
            label: 'Input',
            color: 'green',
            value: { max: [{ minus: [{ query: 'input' }, { query: 'cacheRead' }] }, { const: 0 }] },
          },
          { dataKey: 'cacheRead', label: 'Cache read', color: 'violet', value: { query: 'cacheRead' } },
          { dataKey: 'output', label: 'Output', color: 'sky', value: { query: 'output' } },
        ],
        summary: { label: 'tokens', value: 'total' },
        emptyMessage: 'No model calls in this range.',
      },
    },
    {
      label: 'Cost',
      description: 'Estimated model spend.',
      queries: [sumSeries('input', INPUT), sumSeries('output', OUTPUT)],
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
                { query: 'input', field: 'estimatedCost' },
                { query: 'output', field: 'estimatedCost' },
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

const agentRunsWidget: DashboardWidget = {
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

const failureRateWidget: DashboardWidget = {
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

const latencyView = (label: string, metric: string, rootEntityType: string, noun: string): DashboardWidgetView => ({
  label,
  queries: [
    {
      id: 'latency',
      source: 'metrics',
      request: 'percentiles',
      name: metric,
      percentiles: [0.5, 0.95, 0.99],
    },
  ],
  drilldown: { action: { page: 'traces', filters: [{ fieldId: 'rootEntityType', value: rootEntityType }] } },
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
        emphasis: true,
        value: { query: 'latency', percentile: 0.95 },
        round: true,
      },
      { dataKey: 'p99', label: 'P99', color: 'violet', value: { query: 'latency', percentile: 0.99 }, round: true },
    ],
    summary: { label: 'peak P95', value: { peak: 'p95' } },
    emptyMessage: `No ${noun} in this range.`,
  },
});

const latencyWidget: DashboardWidget = {
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

const distinctIdsWidget: DashboardWidget = {
  id: 'distinct-ids',
  span: 6,
  kind: 'timeseries',
  title: 'Resources and threads',
  description: 'Unique ids on traces; users and sessions only when set.',
  drilldown: { click: { page: 'traces' } },
  views: [
    {
      queries: [
        { id: 'buckets', source: 'traceAggregate', measures: distinctMeasures, limit: 10 },
        { id: 'totals', source: 'traceAggregate', measures: distinctMeasures },
      ],
      options: {
        chart: 'line',
        format: 'count',
        xLabels: 'edges',
        totals: ['totals'],
        hideEmpty: true,
        emphasizeFirst: true,
        series: DISTINCT_IDS.map(([measure, dataKey, label, color]) => ({
          dataKey,
          label,
          color,
          value: { query: 'buckets', measure },
          legendValue: { query: 'totals', measure },
        })),
        emptyMessage: 'No traces in this range set a resource, thread, user or session id.',
      },
    },
  ],
};

const scoresWidget: DashboardWidget = {
  id: 'scores',
  span: 12,
  kind: 'scores',
  title: 'Scores',
  description: 'Average scorer result, 0 to 1.',
  // Scores need a project, so the org dashboard leaves them out (OBS-725).
  scope: 'project',
  views: [
    {
      queries: [
        { id: 'average', source: 'scores', request: 'aggregate', aggregation: 'avg' },
        { id: 'series', source: 'scores', request: 'timeSeries', aggregation: 'avg' },
      ],
      options: { average: 'average', series: 'series', emptyMessage: 'No scores in this range.' },
    },
  ],
};

const USAGE = [INPUT, OUTPUT];
const TRACE_LIMIT = 1000;
const SPAN_LIMIT = 500;
const ERRORS = ['count', 'errorRate', 'duration.p95'] as const;
const hasThread = { op: 'exists', path: 'threadId' } as const;

const usageTotals = (groupBy: string[], filters?: Record<string, string>): DashboardQuery => ({
  id: 'usage',
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

/** Count, errors and P95 from the `figures` query; tokens and cost from `usage`. */
const figureColumns = (
  count: { label: string; measure: string; unit: 'traces' | 'spans' },
  usage: boolean,
): DashboardColumn[] => [
  { id: 'errorRate', options: { query: 'figures', measure: 'errorRate' } },
  { id: 'p95', options: { query: 'figures', measure: 'duration.p95' } },
  ...(usage
    ? [
        { id: 'tokens', options: { query: 'usage', field: 'value' } },
        { id: 'cost', options: { query: 'usage', field: 'estimatedCost' } },
      ]
    : []),
  { id: 'count', label: count.label, options: { query: 'figures', measure: count.measure, unit: count.unit } },
];

const project: DashboardColumn = { id: 'project', scope: 'org' };
const scoped = (scope: 'org' | 'project', dimension: string) =>
  scope === 'org' ? ['projectId', dimension] : [dimension];

const entityView = (
  scope: 'org' | 'project',
  label: string,
  spanTypes: string[],
  description: string,
  emptyMessage: string,
): DashboardWidgetView => {
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
        id: 'figures',
        source: 'spanAggregate',
        where:
          spanTypes.length === 1
            ? { op: 'eq', left: { path: 'spanType' }, right: { literal: spanTypes[0] } }
            : { op: 'in', value: { path: 'spanType' }, set: spanTypes },
        groupBy,
        measures: [
          'count',
          ...(traces ? (['countDistinct.traceId'] as const) : []),
          'errorCount',
          'errorRate',
          'duration.p95',
        ],
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

const traceColumns = (scope: 'org' | 'project'): DashboardColumn[] => [
  ...(scope === 'org' ? [project] : []),
  ...figureColumns({ label: 'Traces', measure: 'count', unit: 'traces' }, true),
];

const environmentsView = (scope: 'org' | 'project'): DashboardWidgetView => {
  const groupBy = scoped(scope, 'environment');
  return {
    label: 'Environments',
    scope,
    description: 'Traces, errors, latency and spend per environment.',
    queries: [
      {
        id: 'figures',
        source: 'traceAggregate',
        groupBy,
        measures: [...ERRORS],
        limit: TRACE_LIMIT,
        compare: 'previousWindow',
      },
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

const threadsView = (scope: 'org' | 'project'): DashboardWidgetView => {
  const groupBy = scoped(scope, 'threadId');
  const threads: DashboardQuery = {
    id: 'figures',
    source: 'traceAggregate',
    where: hasThread,
    groupBy: scope === 'org' ? ['projectId', 'threadId'] : ['resourceId', 'threadId'],
    measures: [...ERRORS],
    limit: TRACE_LIMIT,
    compare: 'previousWindow',
  };
  // Org-wide the second dimension is the project, so a third request names each thread's resource.
  const resources: DashboardQuery = {
    id: 'resources',
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
        options: { query: scope === 'org' ? 'resources' : 'figures', dimension: 'resourceId', joinOn: 'threadId' },
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

const modelsView = (scope: 'org' | 'project'): DashboardWidgetView => {
  const groupBy = scoped(scope, 'model');
  return {
    label: 'Models',
    scope,
    description: 'Model calls, tokens and spend per model.',
    queries: [
      usageTotals(groupBy),
      {
        id: 'calls',
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
      { id: 'tokens', options: { query: 'usage', field: 'value' } },
      { id: 'cost', options: { query: 'usage', field: 'estimatedCost' } },
      { id: 'count', label: 'Spans', options: { query: 'calls', field: 'value', unit: 'spans' } },
    ],
    options: {
      groupBy,
      unnamed: 'Unknown model',
      rowScope: { field: 'model' },
      emptyMessage: 'No model usage in this range.',
    },
  };
};

const scopedViews = (scope: 'org' | 'project'): DashboardWidgetView[] => [
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

const breakdownWidget: DashboardWidget = {
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
          id: 'figures',
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
};

/**
 * The built-in Metrics dashboard: today's Metrics page as a definition. Org and project pages use
 * the same one; scope-tagged widgets, views and columns cover the differences.
 */
export const METRICS_DASHBOARD: DashboardDefinition = {
  schemaVersion: 1,
  rows: [
    { widgets: [kpisWidget] },
    { widgets: [breakdownWidget] },
    { widgets: [tokenUsageWidget] },
    { widgets: [agentRunsWidget, failureRateWidget] },
    { widgets: [latencyWidget, distinctIdsWidget] },
    { widgets: [scoresWidget] },
  ],
};
