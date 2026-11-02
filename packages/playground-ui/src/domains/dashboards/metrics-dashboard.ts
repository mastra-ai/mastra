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

const tokenUsageWidget: DashboardWidget = {
  id: 'token-usage',
  span: 6,
  kind: 'timeseries',
  title: 'Token usage',
  drilldown: { action: { page: 'traces' }, click: { page: 'traces' } },
  views: [
    {
      label: 'Token usage',
      description: 'Input, cache reads and output.',
      queries: [sumSeries('input', INPUT), sumSeries('output', OUTPUT), sumSeries('cacheRead', CACHE_READ)],
      options: {
        chart: 'stackedBar',
        format: 'count',
        xLabels: 'edges',
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
        total: { value: 'total' },
        emptyMessage: 'No model calls in this range.',
      },
    },
    {
      label: 'Model cost',
      description: 'Estimated model spend.',
      // Cache reads aren't charted here, but fetching them keeps their answer, so going back to
      // Token usage sends nothing, as the card's one request for both views does.
      queries: [sumSeries('input', INPUT), sumSeries('output', OUTPUT), sumSeries('cacheRead', CACHE_READ)],
      options: {
        chart: 'stackedBar',
        format: 'usd',
        xLabels: 'edges',
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
        total: { value: 'total' },
        emptyMessage: 'No model calls in this range.',
      },
    },
  ],
};

const failedAgentRuns = [
  { fieldId: 'rootEntityType', value: 'agent' },
  { fieldId: 'status', value: 'error' },
];

/** Agent runs, with Failure rate in its title menu, as the Agent runs card. */
const agentRunsWidget: DashboardWidget = {
  id: 'agent-runs',
  span: 6,
  kind: 'timeseries',
  title: 'Agent runs',
  views: [
    {
      label: 'Agent runs',
      description: 'Completed and failed runs.',
      drilldown: { click: agentRunsTraces },
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
        total: { value: 'total' },
        emptyMessage: 'No agent runs in this range.',
      },
    },
    {
      label: 'Failure rate',
      description: 'Share of agent runs that failed.',
      drilldown: {
        action: { page: 'logs', filters: failedAgentRuns },
        click: { page: 'traces', filters: failedAgentRuns },
      },
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
        total: {
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
    } satisfies DashboardQuery,
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
    total: { value: { peak: 'p95' } },
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
    latencyView('Agent latency', 'mastra_agent_duration_ms', 'agent', 'agent runs'),
    latencyView('Workflow latency', 'mastra_workflow_duration_ms', 'workflow_run', 'workflow runs'),
    latencyView('Tool latency', 'mastra_tool_duration_ms', 'tool', 'tool calls'),
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
          rangeTotal: { query: 'totals', measure },
        })),
        emptyMessage: 'No traces in this range set a resource, thread, user or session id.',
      },
    },
  ],
};

const USAGE = [INPUT, OUTPUT];
const TRACE_LIMIT = 1000;
const SPAN_LIMIT = 500;
type TraceMeasure = NonNullable<Extract<DashboardQuery, { source: 'traceAggregate' }>['measures']>[number];
type SpanMeasure = NonNullable<Extract<DashboardQuery, { source: 'spanAggregate' }>['measures']>[number];
const ERRORS: TraceMeasure[] = ['count', 'errorRate', 'duration.p95'];
/** Traces with a thread. */
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

const TRACE_DESCRIPTION = 'A trace is one end-to-end request, with every step it took.';
const SPAN_DESCRIPTION =
  'A span is one step inside a trace, such as a tool call or a model call. One trace can have many.';

const nameColumn = (label: string, options: Record<string, unknown> = {}): DashboardColumn => ({
  id: 'name',
  label,
  options: { type: 'name', width: 'minmax(12rem,3fr)', ...options },
});
const projectColumn: DashboardColumn = {
  id: 'project',
  label: 'Project',
  scope: 'org',
  options: { type: 'dimension', dimension: 'projectId', as: 'project', width: 'minmax(8rem,2fr)' },
};
const errorColumns: DashboardColumn[] = [
  {
    id: 'errorRate',
    label: 'Errors',
    options: { type: 'value', value: { query: 'figures', measure: 'errorRate' }, format: 'percent', better: 'lower' },
  },
  {
    id: 'p95',
    label: 'P95 latency',
    options: {
      type: 'value',
      value: { query: 'figures', measure: 'duration.p95' },
      format: 'duration',
      better: 'lower',
    },
  },
];
const usageColumns: DashboardColumn[] = [
  {
    id: 'tokens',
    label: 'Tokens',
    options: {
      type: 'value',
      value: { query: 'usage', field: 'value' },
      format: 'count',
      missing: 0,
      additive: true,
      better: 'lower',
    },
  },
  {
    id: 'cost',
    label: 'Cost',
    options: {
      type: 'value',
      value: { query: 'usage', field: 'estimatedCost' },
      format: 'usd',
      additive: true,
      better: 'lower',
      unpricedWhen: 'tokens',
    },
  },
];
const countColumn = (count: { label: string; value: Record<string, unknown>; spans: boolean }): DashboardColumn => ({
  id: 'count',
  label: count.label,
  options: {
    type: 'value',
    value: count.value,
    format: 'count',
    emphasis: true,
    missing: 0,
    additive: true,
    better: 'higher',
    description: count.spans ? SPAN_DESCRIPTION : TRACE_DESCRIPTION,
  },
});
const changeColumn: DashboardColumn = { id: 'change', label: '% Change', options: { type: 'change' } };
const TRACES = { label: 'Traces', value: { query: 'figures', measure: 'count' }, spans: false };

const tableOptions = (groupBy: string[], name: string, emptyMessage: string, extra: Record<string, unknown> = {}) => ({
  groupBy,
  defaultSort: { column: 'count', direction: 'desc' },
  pageSize: 13,
  emptyMessage,
  ariaLabel: `${name} breakdown`,
  ...extra,
});

/** Row clicks open traces in the row's project, plus the row's own name as `field`. */
const drill = (scope: 'org' | 'project', name: string, field: string, extra: Record<string, unknown> = {}) => ({
  rowDrilldown: { fields: { ...(scope === 'org' ? { projectId: 'projectId' } : {}), [name]: field }, ...extra },
});

const scoped = (scope: 'org' | 'project', dimension: string) =>
  scope === 'org' ? ['projectId', dimension] : [dimension];

const ENTITIES = {
  Agents: { name: 'Agent', icon: 'agent', spanTypes: ['agent_run'] },
  Workflows: { name: 'Workflow', icon: 'workflow', spanTypes: ['workflow_run'] },
  Tools: { name: 'Tool', icon: 'tool', spanTypes: ['tool_call', 'mcp_tool_call'] },
} as const;

/** An entity's figures; agents and workflows count the traces they ran in, tools every call. */
const spanMeasures = (traces: boolean): SpanMeasure[] => [
  'count',
  ...(traces ? (['countDistinct.traceId'] as const) : []),
  'errorCount',
  'errorRate',
  'duration.p95',
];

const entityView = (
  scope: 'org' | 'project',
  label: keyof typeof ENTITIES,
  description: string,
  emptyMessage: string,
): DashboardWidgetView => {
  const { name, icon, spanTypes } = ENTITIES[label];
  const groupBy = scoped(scope, 'entityName');
  const usage = label === 'Agents';
  const traces = label !== 'Tools';
  return {
    label: `Breakdown by ${name.toLowerCase()}`,
    scope,
    description,
    queries: [
      {
        id: 'figures',
        source: 'spanAggregate',
        where:
          spanTypes.length === 1
            ? { op: 'eq', left: { path: 'spanType' }, right: { literal: spanTypes[0] } }
            : { op: 'in', value: { path: 'spanType' }, set: [...spanTypes] },
        groupBy,
        measures: spanMeasures(traces),
        limit: SPAN_LIMIT,
        compare: 'previousWindow',
      },
      ...(usage ? [usageTotals(groupBy, { entityType: 'agent' })] : []),
    ],
    columns: [
      nameColumn(name, { mark: { icon } }),
      projectColumn,
      ...errorColumns,
      ...(usage ? usageColumns : []),
      countColumn(
        traces
          ? { label: 'Traces', value: { query: 'figures', measure: 'countDistinct.traceId' }, spans: false }
          : { label: 'Spans', value: { query: 'figures', measure: 'count' }, spans: true },
      ),
      changeColumn,
    ],
    options: tableOptions(
      groupBy,
      name,
      emptyMessage,
      drill(scope, 'entityName', 'entityName', { spanTypes, keepEmpty: true }),
    ),
  };
};

const traceColumns = (
  name: string,
  options: Record<string, unknown> = {},
  extra: DashboardColumn[] = [],
): DashboardColumn[] => [
  nameColumn(name, options),
  projectColumn,
  ...extra,
  ...errorColumns,
  ...usageColumns,
  countColumn(TRACES),
  changeColumn,
];

const environmentsView = (scope: 'org' | 'project'): DashboardWidgetView => {
  const groupBy = scoped(scope, 'environment');
  return {
    label: 'Breakdown by environment',
    scope,
    description: 'Traces, errors, latency and spend per environment.',
    queries: [
      {
        id: 'figures',
        source: 'traceAggregate',
        groupBy,
        measures: ERRORS,
        limit: TRACE_LIMIT,
        compare: 'previousWindow',
      },
      usageTotals(groupBy),
    ],
    columns: traceColumns('Environment', { unnamed: 'No environment' }),
    options: tableOptions(
      groupBy,
      'Environment',
      'No traces in this range.',
      drill(scope, 'environment', 'environment'),
    ),
  };
};

const threadsView = (scope: 'org' | 'project'): DashboardWidgetView => {
  const groupBy = scoped(scope, 'threadId');
  const threads: DashboardQuery = {
    id: 'figures',
    source: 'traceAggregate',
    where: hasThread,
    groupBy: scope === 'org' ? ['projectId', 'threadId'] : ['resourceId', 'threadId'],
    measures: ERRORS,
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
  const resourceColumn: DashboardColumn = {
    id: 'resource',
    label: 'Resource',
    options: {
      type: 'dimension',
      dimension: 'resourceId',
      query: scope === 'org' ? 'resources' : 'figures',
      joinOn: 'threadId',
      width: 'minmax(6rem,1fr)',
    },
  };
  return {
    label: 'Breakdown by thread',
    scope,
    description: 'Traces, errors, latency and spend per thread.',
    queries: [threads, usageTotals(groupBy), ...(scope === 'org' ? [resources] : [])],
    columns: traceColumns('Thread', {}, [resourceColumn]),
    options: tableOptions(groupBy, 'Thread', 'No traces with a thread in this range.', {
      hideUnnamed: true,
      dropped: false,
      ...drill(scope, 'threadId', 'threadId', { keepEmpty: true }),
    }),
  };
};

const modelsView = (scope: 'org' | 'project'): DashboardWidgetView => {
  const groupBy = scoped(scope, 'provider').concat('model');
  return {
    label: 'Breakdown by model',
    scope,
    description: 'Model calls, tokens and spend per model.',
    queries: [
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
      usageTotals(groupBy),
    ],
    columns: [
      nameColumn('Model', { unnamed: 'Unknown model', mark: { providerDimension: 'provider' } }),
      projectColumn,
      ...usageColumns,
      countColumn({ label: 'Spans', value: { query: 'calls', field: 'value' }, spans: true }),
      changeColumn,
    ],
    options: tableOptions(groupBy, 'Model', 'No model usage in this range.', drill(scope, 'model', 'model')),
  };
};

const scopedViews = (scope: 'org' | 'project'): DashboardWidgetView[] => [
  entityView(
    scope,
    'Agents',
    'Traces each agent ran in, nested runs included, with errors, latency and spend.',
    'No agent runs in this range.',
  ),
  entityView(
    scope,
    'Workflows',
    'Traces each workflow ran in, nested runs included, with errors and latency.',
    'No workflow runs in this range.',
  ),
  entityView(
    scope,
    'Tools',
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
  kind: 'table',
  title: 'Breakdown',
  drilldown: { click: { page: 'traces' } },
  views: [
    {
      label: 'Breakdown by project',
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
      columns: [
        nameColumn('Project', { as: 'project' }),
        ...errorColumns,
        ...usageColumns,
        countColumn(TRACES),
        changeColumn,
      ],
      options: tableOptions(['projectId'], 'Project', 'No traces in this range.', {
        openWhen: { minRows: 2 },
        rowDrilldown: { fields: { projectId: 'projectId' } },
      }),
    },
    ...scopedViews('org'),
    ...scopedViews('project'),
  ],
};

/** Freezes a value and everything it holds, so a shared definition can't be edited in place. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * The Metrics page as a dashboard: four charts in two rows (usage and health first), then the
 * breakdown of who caused them. Org and project pages share it; scope-tagged parts pick per page.
 * It is frozen: copy it (`structuredClone(METRICS_DASHBOARD)`) before customising.
 */
export const METRICS_DASHBOARD: DashboardDefinition = deepFreeze({
  schemaVersion: 1,
  rows: [
    { widgets: [tokenUsageWidget, agentRunsWidget] },
    { widgets: [latencyWidget, distinctIdsWidget] },
    { widgets: [breakdownWidget] },
  ],
});
