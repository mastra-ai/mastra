import { expect, it } from 'vitest';
import { createObservabilityDraftSchemas } from '../dashboards';
import type { ObservabilityWidgetDraft } from '../dashboards';

// The widgets Mastra Cloud's chat writes and its widget editor opens with nothing locked
// (platform `widget-editor/chat-parity.test.ts`).
const INPUT = 'mastra_model_total_input_tokens';
const OUTPUT = 'mastra_model_total_output_tokens';
const AGENT_DURATION = 'mastra_agent_duration_ms';
const FAILED = ['error', 'failed'];
const runs = { name: [AGENT_DURATION], aggregation: 'count' as const };
const compared = (name: string[]) => ({
  name,
  aggregation: 'sum' as const,
  compare: 'previousWindow' as const,
});

// Widgets as the chat writes them (services/observability-mcp/src/widget-tool.ts `PRESETS`, plus
// the shapes its free-form tool accepts), stored through the chat's own converter.
const DRAFTS = {
  overview: {
    id: 'overview',
    span: 12,
    kpis: {
      items: [
        {
          label: 'Agent runs',
          icon: 'bot',
          format: 'count',
          value: { metricAggregate: { ...runs, compare: 'previousWindow' } },
          detail: 'in this range',
        },
        {
          label: 'Model cost',
          icon: 'coins',
          format: 'usd',
          value: { metricAggregate: { ...compared([INPUT, OUTPUT]), field: 'estimatedCost' } },
          detail: 'estimated',
          lowerIsBetter: true,
        },
        {
          label: 'Tokens',
          icon: 'hash',
          format: 'count',
          value: {
            sum: [{ metricAggregate: compared([INPUT]) }, { metricAggregate: compared([OUTPUT]) }],
          },
          detail: 'input and output',
        },
      ],
    },
  },
  agentRuns: {
    id: 'agent-runs',
    span: 12,
    title: 'Agent runs',
    timeseries: {
      label: 'Agent runs',
      description: 'Completed and failed runs.',
      chart: 'stackedBar',
      format: 'count',
      xLabels: 'edges',
      series: [
        {
          label: 'Completed',
          color: 'green',
          value: { metricTimeSeries: { ...runs, groupBy: ['status'], notGroups: FAILED } },
        },
        {
          label: 'Failed',
          color: 'error',
          value: { metricTimeSeries: { ...runs, groupBy: ['status'], groups: FAILED } },
        },
      ],
      total: { value: 'total' },
      emptyMessage: 'No agent runs in this range.',
    },
  },
  tokenUsage: {
    id: 'token-usage',
    span: 12,
    title: 'Token usage',
    timeseries: {
      label: 'Token usage',
      description: 'Input and output tokens.',
      chart: 'stackedBar',
      format: 'count',
      xLabels: 'edges',
      series: [
        {
          label: 'Input',
          color: 'green',
          value: { metricTimeSeries: { name: [INPUT], aggregation: 'sum' } },
        },
        {
          label: 'Output',
          color: 'sky',
          value: { metricTimeSeries: { name: [OUTPUT], aggregation: 'sum' } },
        },
      ],
      total: { value: 'total' },
      emptyMessage: 'No model calls in this range.',
    },
  },
  latency: {
    id: 'latency',
    span: 12,
    title: 'Agent latency',
    description: 'Duration percentiles.',
    timeseries: {
      label: 'Agent latency',
      chart: 'line',
      format: 'duration',
      buckets: 'api',
      xLabels: 'edges',
      series: [
        {
          label: 'P50',
          color: 'sky',
          value: { metricPercentiles: { name: AGENT_DURATION, percentile: 0.5 } },
          round: true,
        },
        {
          label: 'P95',
          color: 'green',
          value: { metricPercentiles: { name: AGENT_DURATION, percentile: 0.95 } },
          round: true,
        },
      ],
      emptyMessage: 'No agent runs in this range.',
    },
  },
  splitByModel: {
    id: 'split-by-model',
    timeseries: {
      label: 'Input tokens by model',
      chart: 'stackedBar',
      format: 'count',
      series: ['gpt-4o', 'claude'].map((model, i) => ({
        label: model,
        color: (['sky', 'green'] as const)[i],
        value: {
          metricTimeSeries: {
            name: [INPUT],
            aggregation: 'sum',
            groupBy: ['model'],
            groups: [model],
          },
        },
      })),
    },
  },
  outputPerInput: {
    id: 'output-per-input',
    timeseries: {
      label: 'Output per input token',
      chart: 'line',
      format: 'count',
      series: [
        {
          label: 'Output ÷ input',
          color: 'violet',
          value: {
            ratio: {
              of: { metricTimeSeries: { name: [OUTPUT], aggregation: 'sum' } },
              over: { metricTimeSeries: { name: [INPUT], aggregation: 'sum' } },
            },
          },
        },
      ],
    },
  },
  customMetric: {
    id: 'cache-hits',
    timeseries: {
      label: 'Cache hits',
      chart: 'stackedBar',
      format: 'count',
      series: [
        {
          label: 'Hits',
          color: 'teal',
          value: { metricTimeSeries: { name: ['acme_cache_hits'], aggregation: 'sum' } },
        },
      ],
    },
  },
  tableByModel: {
    id: 'cost-by-model',
    table: {
      label: 'Cost by model',
      groupBy: ['model'],
      emptyMessage: 'None',
      columns: [
        { label: 'Model', name: {} },
        {
          label: 'Cost',
          value: {
            format: 'usd',
            metricBreakdown: { name: [INPUT, OUTPUT], aggregation: 'sum', field: 'estimatedCost' },
          },
        },
      ],
    },
  },
  traceKpis: {
    id: 'trace-kpis',
    kpis: {
      items: [
        {
          label: 'P95 latency',
          format: 'duration',
          value: { traceAggregate: { measure: 'duration.p95', compare: 'previousWindow' } },
          lowerIsBetter: true,
        },
        {
          label: 'Error rate',
          format: 'percent',
          value: { spanAggregate: { measure: 'errorRate', compare: 'previousWindow' } },
          detail: 'of spans',
          lowerIsBetter: true,
        },
      ],
    },
  },
  uncomparedKpis: {
    id: 'uncompared-kpis',
    kpis: {
      items: [
        {
          label: 'Tool calls',
          format: 'count',
          value: { metricAggregate: { name: ['mastra_tool_duration_ms'], aggregation: 'count' } },
        },
      ],
    },
  },
  peakEmphasized: {
    id: 'peak-emphasized',
    timeseries: {
      label: 'Token peak',
      chart: 'line',
      format: 'count',
      series: [
        {
          label: 'Input',
          color: 'green',
          value: { metricTimeSeries: { name: [INPUT], aggregation: 'sum' } },
        },
        {
          label: 'Output',
          color: 'sky',
          emphasis: true,
          value: { metricTimeSeries: { name: [OUTPUT], aggregation: 'sum' } },
        },
      ],
      total: { value: 'peak' },
    },
  },
  splitColors: {
    id: 'split-colors',
    timeseries: {
      label: 'Runs by environment',
      chart: 'stackedBar',
      format: 'count',
      series: ['prod', 'dev'].map((environment, i) => ({
        label: environment,
        color: (['error', 'teal'] as const)[i],
        value: {
          metricTimeSeries: { ...runs, groupBy: ['environment'], groups: [environment] },
        },
      })),
    },
  },
  filteredTraces: {
    id: 'filtered-traces',
    timeseries: {
      label: 'Prod traces',
      chart: 'stackedBar',
      format: 'count',
      series: [
        {
          label: 'Traces',
          color: 'sky',
          value: {
            traceAggregate: {
              measure: 'count',
              where: { op: 'eq', left: { path: 'environment' }, right: { literal: 'prod' } },
            },
          },
        },
      ],
    },
  },
  helpfulness: {
    id: 'helpfulness',
    scores: {
      label: 'Helpfulness',
      scorerId: 'helpfulness',
      emptyMessage: 'None',
      average: { aggregation: 'avg' },
      series: { aggregation: 'avg' },
    },
  },
} as unknown as Record<string, ObservabilityWidgetDraft>;

const { widget: editable } = createObservabilityDraftSchemas({}, { editable: true });
const { widget: free } = createObservabilityDraftSchemas();

/** The issues `editable` reports for `draft`, as `path: message`. */
const issuesOf = (draft: unknown) => {
  const result = editable.safeParse(draft);
  return result.success ? [] : result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
};

const chart = (series: unknown[], rest: object = {}) => ({
  timeseries: { chart: 'line', format: 'count', series, ...rest },
});
const line = (value: unknown, rest: object = {}) => ({ label: 'Series', value, ...rest });
const tokens = (name: string) => ({ metricTimeSeries: { name: [name], aggregation: 'sum' } });

it.each(Object.entries(DRAFTS))('accepts what the editor edits: %s', (_, draft) => {
  expect(issuesOf(draft)).toEqual([]);
});

it('accepts an error rate on a chart', () => {
  const read = (pick: object) => ({ metricTimeSeries: { ...runs, groupBy: ['status'], ...pick } });
  const errorRate = {
    coalesce: [
      {
        ratio: { of: read({ groups: FAILED }), over: { sum: [read({ notGroups: FAILED }), read({ groups: FAILED })] } },
      },
      { const: 0 },
    ],
  };
  expect(issuesOf(chart([line(errorRate)], { format: 'percent' }))).toEqual([]);
  // On any other metric it isn't one of the editor's error rates.
  const other = JSON.parse(JSON.stringify(errorRate).replaceAll(AGENT_DURATION, 'mastra_model_duration_ms'));
  expect(issuesOf(chart([line(other)], { format: 'percent' }))).toEqual([
    expect.stringContaining(
      'timeseries.series.0.value.coalesce.0.ratio.of.metricTimeSeries.name: An error rate reads one of',
    ),
  ]);
});

it('accepts the floored and share formulas', () => {
  const floored = { max: [{ minus: [tokens(OUTPUT), tokens(INPUT)] }, { const: 0 }] };
  const share = { ratio: { of: tokens(INPUT), over: { sum: [tokens(INPUT), tokens(OUTPUT)] } } };
  expect(issuesOf(chart([line(floored), line(share)]))).toEqual([]);
});

it('rejects formulas the editor has no preset for', () => {
  const three = { sum: [tokens(INPUT), tokens(OUTPUT), tokens(INPUT)] };
  const nested = { minus: [{ sum: [tokens(INPUT), tokens(OUTPUT)] }, tokens(INPUT)] };
  const constant = { const: 1 };
  const max = { max: [tokens(INPUT), tokens(OUTPUT)] };
  const coalesce = { coalesce: [tokens(INPUT), { const: 0 }] };
  const share = { ratio: { of: tokens(OUTPUT), over: { sum: [tokens(INPUT), tokens(OUTPUT)] } } };
  const issues = issuesOf(chart([three, nested, constant, max, coalesce, share].map(value => line(value))));
  expect(issues).toHaveLength(6);
  issues.forEach((issue, i) =>
    expect(issue).toMatch(new RegExp(`^timeseries\\.series\\.${i}\\.value: The widget editor edits`)),
  );
});

it('rejects metric reads outside what the editor offers', () => {
  const read = (args: object) => line({ metricTimeSeries: { name: [INPUT], aggregation: 'sum', ...args } });
  expect(
    issuesOf(
      chart([
        read({ name: [INPUT, 'acme_cache_hits'] }),
        read({ name: [INPUT, OUTPUT], aggregation: 'avg' }),
        read({ field: 'estimatedCost', aggregation: 'max' }),
        read({ aggregation: 'count_distinct' }),
        read({ filters: { labels: { status: 'error' } } }),
        line({ metricPercentiles: { name: AGENT_DURATION, percentile: 0.9 } }),
      ]),
    ),
  ).toEqual([
    expect.stringMatching(/^timeseries\.series\.0\.value\.metricTimeSeries\.name: Read one metric name/),
    'timeseries.series.1.value.metricTimeSeries.aggregation: Input and output tokens read together take `sum`.',
    'timeseries.series.2.value.metricTimeSeries.aggregation: A cost (`field: "estimatedCost"`) takes `sum`.',
    expect.stringMatching(
      /^timeseries\.series\.3\.value\.metricTimeSeries\.aggregation: The editor offers the aggregations/,
    ),
    expect.stringMatching(
      /^timeseries\.series\.4\.value\.metricTimeSeries\.filters\.labels: The editor filters on one value of/,
    ),
    expect.stringMatching(
      /^timeseries\.series\.5\.value\.metricPercentiles\.percentile: The editor offers the percentiles/,
    ),
    // The `labels` filter also sets that read apart from the others.
    'timeseries: Every read must filter on the same dimensions and values: the editor filters the whole view at once.',
  ]);
});

it('rejects filters that differ between reads', () => {
  const prod = { metricTimeSeries: { name: [INPUT], aggregation: 'sum', filters: { environment: 'prod' } } };
  expect(issuesOf(chart([line(prod), line(tokens(OUTPUT))]))).toEqual([
    'timeseries: Every read must filter on the same dimensions and values: the editor filters the whole view at once.',
  ]);
  // The same filter on a trace read, written as its `where`, matches.
  const traces = {
    traceAggregate: {
      measure: 'count',
      where: { op: 'eq', left: { path: 'environment' }, right: { literal: 'prod' } },
    },
  };
  expect(issuesOf(chart([line(prod), line(traces)]))).toEqual([]);
});

it('rejects a trace `where` that is more than dimension filters', () => {
  const where = { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } };
  const spans = { spans: { some: { op: 'eq', left: { path: 'model' }, right: { literal: 'gpt-4o' } } } };
  expect(issuesOf(chart([line({ traceAggregate: { measure: 'count', where } })]))).toEqual([
    expect.stringMatching(/^timeseries\.series\.0\.value\.traceAggregate\.where: `where` can only filter on/),
  ]);
  expect(issuesOf(chart([line({ traceAggregate: { measure: 'count', where: spans } })]))).toEqual([]);
  expect(issuesOf(chart([line({ spanAggregate: { measure: 'count', where: spans } })]))).toHaveLength(1);
});

it('rejects status and split groupings the editor cannot draw', () => {
  const status = (args: object) => ({ metricTimeSeries: { ...runs, groupBy: ['status'], ...args } });
  expect(
    issuesOf(chart([line(status({ groups: ['error'] })), line(status({ groups: FAILED, aggregation: 'sum' }))])),
  ).toEqual([
    expect.stringMatching(/^timeseries\.series\.0\.value\.metricTimeSeries\.groups: Pick failed runs/),
    'timeseries.series.1.value.metricTimeSeries.aggregation: Runs by `status` take `count`.',
  ]);
  const split = (model: string, args: object = {}) => ({
    metricTimeSeries: { name: [INPUT], aggregation: 'sum', groupBy: ['model'], groups: [model], ...args },
  });
  expect(issuesOf(chart([line(split('gpt-4o')), line(tokens(OUTPUT))]))).toEqual([
    expect.stringMatching(/^timeseries\.series\.1\.value: A split chart's series each read one/),
  ]);
  expect(issuesOf(chart([line(split('gpt-4o', { groups: ['gpt-4o', 'claude'] }))]))).toEqual([
    'timeseries.series.0.value.metricTimeSeries.groups: Each series of a split picks one value: `groups: [value]`.',
  ]);
  expect(issuesOf(chart([line(split('gpt-4o'), { emphasis: true }), line(split('claude'))]))).toEqual([
    "timeseries.series: Emphasize all of a split metric's series or none.",
  ]);
  expect(
    issuesOf(chart([line(split('gpt-4o')), line(split('claude')), line(split('gpt-4o', { name: [OUTPUT] }))])),
  ).toEqual(['timeseries.series: Every split metric lists the same `model` values, in the same order.']);
});

it('leaves out the chart settings the editor does not hold', () => {
  const draft = chart(
    [line(tokens(INPUT), { rangeTotal: { metricAggregate: { name: [INPUT], aggregation: 'sum' } } })],
    {
      total: { value: { metricAggregate: { name: [INPUT], aggregation: 'sum' } }, format: 'usd' },
      emptyWhenZero: { metricAggregate: { name: [INPUT], aggregation: 'sum' } },
    },
  );
  expect(free.safeParse(draft).success).toBe(true);
  expect(issuesOf(draft)).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/rangeTotal/),
      expect.stringMatching(/^timeseries\.total/),
      expect.stringMatching(/emptyWhenZero/),
    ]),
  );
});

it('rejects a chart that compares with the window before', () => {
  const draft = chart([line({ metricTimeSeries: { name: [INPUT], aggregation: 'sum', compare: 'previousWindow' } })]);
  expect(issuesOf(draft)).toEqual([
    "timeseries.series.0.value.metricTimeSeries.compare: A chart doesn't compare with the window before.",
  ]);
});

it('rejects KPIs compared only in part', () => {
  const kpis = {
    kpis: {
      items: [
        { label: 'Runs', format: 'count', value: { metricAggregate: { ...runs, compare: 'previousWindow' } } },
        {
          label: 'Tools',
          format: 'count',
          value: { metricAggregate: { name: ['mastra_tool_duration_ms'], aggregation: 'count' } },
        },
      ],
    },
  };
  expect(issuesOf(kpis)).toEqual(['kpis: Set `compare` on every read or on none: the editor compares the whole view.']);
});

it('keeps a table to its name, value and change columns', () => {
  const cost = { metricBreakdown: { name: [INPUT, OUTPUT], aggregation: 'sum', field: 'estimatedCost' } };
  const table = (columns: unknown[], rest: object = {}) => ({ table: { groupBy: ['model'], columns, ...rest } });
  expect(issuesOf(table([{ name: {} }, { value: { format: 'usd', ...cost } }, { change: {} }]))).toEqual([
    'table.columns.2: A `change` column needs `compare` on every read.',
  ]);
  expect(issuesOf(table([{ value: { format: 'usd', ...cost } }, { name: {} }]))).toEqual([
    'table.columns: Start with one `name` column, then the value columns, then at most one `change` column.',
  ]);
  expect(issuesOf(table([{ name: {}, sort: 'asc' }, { value: { format: 'usd', ...cost } }]))).toEqual([
    'table.columns.0.sort: Only a value column sorts the table.',
  ]);
  expect(
    issuesOf(
      table([
        { name: {} },
        { value: { format: 'usd', metricBreakdown: { ...cost.metricBreakdown, groupBy: ['provider'] } } },
      ]),
    ),
  ).toEqual(["table.columns.1.value.metricBreakdown.groupBy: Leave `groupBy` out: a table's reads group by its own."]);
  expect(issuesOf(table([{ name: {} }, { value: { format: 'usd', ...cost } }], { groupBy: ['status'] }))).toEqual([
    expect.stringMatching(/^table\.groupBy: The rows group by one of/),
  ]);
  // Dimension columns and `unpricedWhen` aren't in the editable schema at all.
  const byProvider = { groupBy: ['provider', 'model'] };
  const dimension = table(
    [{ name: {} }, { dimension: { dimension: 'provider' } }, { value: { format: 'usd', ...cost } }],
    byProvider,
  );
  expect(free.safeParse(dimension).success).toBe(true);
  expect(issuesOf(dimension)).not.toEqual([]);
  const unpriced = table([
    { name: {} },
    { id: 'tokens', value: { format: 'count', metricBreakdown: { name: [INPUT, OUTPUT], aggregation: 'sum' } } },
    { value: { format: 'usd', unpricedWhen: 'tokens', ...cost } },
  ]);
  expect(free.safeParse(unpriced).success).toBe(true);
  expect(issuesOf(unpriced)).not.toEqual([]);
});

it('reads a scorer by its id only', () => {
  expect(
    issuesOf({
      scores: {
        scorerId: 'helpfulness',
        scoreSource: 'live',
        average: { aggregation: 'avg' },
        series: { aggregation: 'avg' },
      },
    }),
  ).toEqual(['scores.scoreSource: The editor reads a scorer by `scorerId` only.']);
});
