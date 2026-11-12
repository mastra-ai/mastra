import { DASHBOARD_MAX_WIDGETS, dashboardDefinitionSchema } from '@mastra/core/storage/dashboards';
import type { DashboardColumn, DashboardWidget, DashboardWidgetView } from '@mastra/core/storage/dashboards';
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { METRICS_DASHBOARD } from '@mastra/playground-ui/domains/dashboards/metrics-dashboard';
import {
  AnthropicSchemaCompatLayer,
  GoogleSchemaCompatLayer,
  OpenAISchemaCompatLayer,
  applyCompatLayer,
} from '@mastra/schema-compat';
import { afterEach, expect, it } from 'vitest';
import { z } from 'zod/v4';
// Imported from the entry Node services use, so a name it's documented to export but doesn't fails here.
import {
  OBSERVABILITY_CATALOG_MAX_METRIC_NAMES,
  createObservabilityDraftSchemas,
  createObservabilityWidgetInputSchema,
  observabilityWidgetInputSchema,
  strictDashboardDefinitionSchema,
  strictDashboardWidgetSchema,
  toObservabilityDashboard,
  toObservabilityWidget,
} from '../dashboards';
import type { ObservabilityDashboardInput, ObservabilityWidgetDraft } from '../dashboards';
import {
  createObservabilityDashboardInputSchema,
  observabilityDashboardInputSchema,
  observabilityDashboardOutputSchema,
} from '../observability-dashboard';
import { serveAndConnect } from './greeting-server';
import { agentRunsChart, agentRunsKpi, draftOf, observabilityServer } from './observability-server';

const hosts: Awaited<ReturnType<typeof serveAndConnect>>[] = [];
afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.close()));
});

async function connect(server = observabilityServer().server) {
  const host = await serveAndConnect(server);
  hosts.push(host);
  return host.client;
}

/** The opening tool with its metric names limited to `metricNames`, as a server builds it from its catalog. */
const dashboardToolFor = (metricNames: string[]) =>
  createTool({
    id: 'showObservabilityDashboard',
    description: 'Shows an observability dashboard',
    inputSchema: createObservabilityDashboardInputSchema({ metricNames }),
    outputSchema: observabilityDashboardOutputSchema,
    execute: async input => toObservabilityDashboard(input),
  });

const metricNamesIn = (inputSchema: unknown) => {
  const names = JSON.stringify(inputSchema).match(/"enum":\["mastra_[^\]]*\]/g) ?? [];
  return [...new Set(names)];
};

const { id: _id, ...kpiDraft } = draftOf(agentRunsKpi) as Extract<ObservabilityWidgetDraft, { kpis: unknown }>;
const chartDraft = draftOf(agentRunsChart) as Extract<ObservabilityWidgetDraft, { timeseries: unknown }>;

const widgets = (opened: ReturnType<typeof toObservabilityDashboard>) =>
  opened.dashboard.rows.flatMap(row => row.widgets);

/** Storage takes `definition` as written and as core parses it, filling in defaults; both must render. */
const expectRenderable = (definition: unknown) => {
  expect(strictDashboardDefinitionSchema.safeParse(definition).error?.issues).toBeUndefined();
  const parsed = dashboardDefinitionSchema.parse(definition);
  expect(strictDashboardDefinitionSchema.safeParse(parsed).error?.issues).toBeUndefined();
};

it("advertises each kind's options to the model, with each read's arguments listed once", async () => {
  const client = await connect();

  const { tools } = await client.listTools();
  const tool = tools.find(t => t.name === 'showObservabilityDashboard')!;
  const schema = JSON.stringify(tool.inputSchema);

  expect(schema).toContain('"stackedBar"');
  expect(schema).toContain('"lowerIsBetter"');
  expect(schema.match(/"MastraMetricTimeSeriesRead":/g)).toHaveLength(1);
  // Every metric read takes the same filters, as does every score read: each is written out once.
  expect(schema.match(/"MastraMetricFilters":/g)).toHaveLength(1);
  expect(schema.match(/"MastraScoreFilters":/g)).toHaveLength(1);
  // Nothing in a view points at anything else by id but `unpricedWhen`.
  expect(schema).not.toContain('"defaultSort"');
  expect(schema).not.toContain('"totals"');
  expect(schema).not.toContain('"dataKey"');
  // An unknown metric name reads as zero, so the model is told the ones Mastra emits.
  expect(schema).toContain('mastra_agent_duration_ms');
  expect(schema).toContain('mastra_model_total_input_tokens');
  // Small enough to sit in a model's tool list.
  expect(schema.length).toBeLessThan(50_000);
});

/** Every value under a `filters` key in `node`, but in the dashboard's own `defaults`. */
const readFiltersIn = (node: unknown): unknown[] =>
  node && typeof node === 'object'
    ? Object.entries(node).flatMap(([key, value]) =>
        key === 'defaults' ? [] : [...(key === 'filters' ? [value] : []), ...readFiltersIn(value)],
      )
    : [];

it.each([
  ['OpenAI', new OpenAISchemaCompatLayer({ provider: 'openai', modelId: 'gpt-5', supportsStructuredOutputs: true })],
  [
    'Anthropic',
    new AnthropicSchemaCompatLayer({
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-5',
      supportsStructuredOutputs: false,
    }),
  ],
  [
    'Gemini',
    new GoogleSchemaCompatLayer({ provider: 'google', modelId: 'gemini-2.5-pro', supportsStructuredOutputs: false }),
  ],
])("keeps each read's filters once %s's compatibility layer rewrites the schema", (_, layer) => {
  const schema = applyCompatLayer({
    schema: observabilityDashboardInputSchema,
    compatLayers: [layer],
    mode: 'jsonSchema',
  });

  const defs = { ...schema.definitions, ...(schema as { $defs?: object }).$defs } as Record<string, unknown>;
  const resolved = (value: unknown) =>
    JSON.stringify(value).replace(/\{"\$ref":"#\/(?:definitions|\$defs)\/(\w+)"\}/g, (_, id) =>
      JSON.stringify(defs[id]),
    );

  const filters = readFiltersIn(schema).map(resolved);
  // The metric and score reads' filters, wherever each is written.
  expect(filters.length).toBeGreaterThanOrEqual(2);
  for (const written of filters) expect(written).toContain('"traceId"');
});

it('opens through the tool with missing ids assigned and given ids kept', async () => {
  const client = await connect();

  const result = await client.callTool({
    name: 'showObservabilityDashboard',
    arguments: {
      dashboard: { rows: [{ widgets: [kpiDraft, kpiDraft] }, { widgets: [chartDraft] }] },
      datePreset: '14d',
    } satisfies ObservabilityDashboardInput,
  });

  expect(result.isError).toBeFalsy();
  const opened = result.structuredContent as ReturnType<typeof toObservabilityDashboard>;
  expect(opened.datePreset).toBe('14d');
  expect(dashboardDefinitionSchema.safeParse(opened.dashboard).success).toBe(true);
  expectRenderable(opened.dashboard);
  const [first, second, chart] = widgets(opened);
  expect(first).toEqual({ ...agentRunsKpi, id: first!.id });
  // The same widget twice gets two ids, so each can be pinned on its own.
  expect(first!.id).toEqual(expect.any(String));
  expect(first!.id).not.toBe(second!.id);
  expect(chart).toEqual(agentRunsChart);
});

it('gathers the reads a view makes into its queries, one per distinct read', () => {
  const tokens = { name: ['mastra_model_total_input_tokens'], aggregation: 'sum' as const };
  const opened = toObservabilityDashboard({
    dashboard: {
      rows: [
        {
          widgets: [
            {
              id: 'agent-runs-chart',
              span: 6,
              title: 'Agent runs over time',
              timeseries: {
                chart: 'stackedBar',
                format: 'count',
                series: [
                  {
                    label: 'Runs',
                    color: 'green',
                    value: {
                      metricTimeSeries: {
                        name: ['mastra_agent_duration_ms'],
                        aggregation: 'count',
                        groupBy: ['status'],
                      },
                    },
                  },
                ],
              },
            },
            {
              span: 6,
              kpis: {
                items: [
                  {
                    label: 'Input',
                    icon: 'coins',
                    format: 'count',
                    detail: 'tokens',
                    value: { metricAggregate: tokens },
                  },
                  {
                    label: 'Input cost',
                    icon: 'coins',
                    format: 'usd',
                    detail: 'estimated',
                    value: { metricAggregate: { ...tokens, field: 'estimatedCost' } },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  });

  const [chart, kpis] = widgets(opened);
  expect(chart).toEqual(agentRunsChart);
  // The two KPIs read one query, each picking its own field.
  expect(kpis!.views[0]!.queries).toEqual([{ id: 'q1', source: 'metrics', request: 'aggregate', ...tokens }]);
  expect(kpis!.views[0]!.options).toMatchObject({
    items: [{ value: { query: 'q1' } }, { value: { query: 'q1', field: 'estimatedCost' } }],
  });
});

it('spans the full row when a widget leaves `span` out', () => {
  const { span: _span, ...draft } = kpiDraft;
  const [widget] = widgets(toObservabilityDashboard({ dashboard: { rows: [{ widgets: [draft] }] } }));
  expect(widget!.span).toBe(12);
});

/**
 * `widget` as the observability widget draws it: at project scope, with org-only views and columns
 * left out, and without drilldowns (the widget has no page to open). Columns looking a dimension up
 * in another query are left out too: no model wrote one, so the draft has no way to.
 */
function asDrawn({ scope: _scope, drilldown: _d, ...widget }: DashboardWidget): DashboardWidget {
  const kept = (item: DashboardColumn) =>
    item.scope !== 'org' && !(item.options?.type === 'dimension' && item.options.query);
  return {
    ...widget,
    views: widget.views
      .filter(view => view.scope !== 'org')
      .map(({ scope: _s, drilldown: _vd, columns, options, ...view }) => {
        const { rowDrilldown: _r, ...rest } = (options ?? {}) as { rowDrilldown?: unknown };
        return {
          ...view,
          ...(options ? { options: rest } : {}),
          ...(columns ? { columns: columns.filter(kept).map(({ scope: _c, ...column }) => column) } : {}),
        } as DashboardWidgetView;
      }),
  };
}

it.each(METRICS_DASHBOARD.rows.flatMap(row => row.widgets).map(widget => [widget.id, asDrawn(widget)] as const))(
  "opens Studio's %s widget, written as a draft, to a widget making the same reads",
  (_, widget) => {
    const draft = draftOf(widget);

    const [opened] = widgets(toObservabilityDashboard({ dashboard: { rows: [{ widgets: [draft] }] } }));

    expect(dashboardDefinitionSchema.safeParse({ schemaVersion: 1, rows: [{ widgets: [opened] }] }).success).toBe(true);
    expectRenderable({ schemaVersion: 1, rows: [{ widgets: [opened] }] });
    expect(draftOf(opened!)).toEqual(draft);
    opened!.views.forEach((view, i) =>
      expect(view.queries.length).toBeLessThanOrEqual(widget.views[i]!.queries.length),
    );
    // Saved on its own, the widget is the one the dashboard opens, and renders as written and once core parsed it.
    const saved = toObservabilityWidget(draft);
    expect(saved).toEqual(opened);
    expect(strictDashboardWidgetSchema.safeParse(saved).error?.issues).toBeUndefined();
    const { rows } = dashboardDefinitionSchema.parse({ schemaVersion: 1, rows: [{ widgets: [saved] }] });
    expect(strictDashboardWidgetSchema.safeParse(rows[0]!.widgets[0]).error?.issues).toBeUndefined();
  },
);

it("gives a fresh id on every open, so a widget doesn't collide with the one pinned last time", () => {
  const input: ObservabilityDashboardInput = { dashboard: { rows: [{ widgets: [kpiDraft] }] } };

  const [a] = widgets(toObservabilityDashboard(input));
  const [b] = widgets(toObservabilityDashboard(input));

  expect(a!.id).not.toBe(b!.id);
});

const chart = chartDraft.timeseries!;
const runs = chart.series[0]!.value as { metricTimeSeries: object };
const tableDraft = (columns: unknown[]) =>
  ({
    span: 12,
    table: { groupBy: ['entityName'], pageSize: 20, emptyMessage: 'No runs', columns },
  }) as never;
const name = { name: {} };
const count = { value: { traceAggregate: { measure: 'count' }, format: 'count' } };
const dashboardOf = (...widgets: unknown[]) => ({ rows: [{ widgets }] }) as ObservabilityDashboardInput['dashboard'];

it.each<[string, ObservabilityDashboardInput['dashboard'], string]>([
  [
    'a KPI reading something other than an aggregate',
    dashboardOf({
      ...kpiDraft,
      kpis: { items: [{ label: 'Runs', icon: 'bot', format: 'count', detail: 'in range', value: runs }] },
    }),
    'A value takes exactly one of `metricAggregate`, `scoreAggregate`, `traceAggregate`, `spanAggregate`, `const`, `sum`, `minus`, `ratio`, `max`, `coalesce`, not `metricTimeSeries`',
  ],
  [
    'a kind no renderer draws',
    dashboardOf({ span: 12, pie: kpiDraft.kpis }),
    'A widget takes exactly one of `kpis`, `timeseries`, `table`, `scores`',
  ],
  ['a widget of two kinds', dashboardOf({ ...kpiDraft, timeseries: chart }), 'not `kpis`, `timeseries`'],
  [
    'a value of two reads',
    dashboardOf({
      ...chartDraft,
      timeseries: { ...chart, series: [{ ...chart.series[0], value: { ...runs, sum: [runs] } }] },
    }),
    'A value takes exactly one of',
  ],
  ['a table with no value column', dashboardOf(tableDraft([name])), 'at least one `value` column'],
  [
    'a value column nesting its number under a second `value`',
    dashboardOf(tableDraft([name, { value: { format: 'count', value: { traceAggregate: { measure: 'count' } } } }])),
    'A value column takes exactly one of `traceAggregate`, `spanAggregate`, `metricBreakdown`, `const`, `sum`, `minus`, `ratio`, `max`, `coalesce`, not `value`',
  ],
  [
    'a value column reading an ungrouped aggregate',
    dashboardOf(
      tableDraft([name, { value: { format: 'count', metricAggregate: { name: ['x'], aggregation: 'sum' } } }]),
    ),
    'A value column takes exactly one of `traceAggregate`, `spanAggregate`, `metricBreakdown`, `const`, `sum`, `minus`, `ratio`, `max`, `coalesce`, not `metricAggregate`',
  ],
  [
    'a table sorted by two columns',
    dashboardOf(tableDraft([name, { sort: 'desc', ...count }, { sort: 'asc', ...count }])),
    'At most one column sets `sort`',
  ],
  [
    'a value column unpriced when a column the table lacks',
    dashboardOf(tableDraft([name, { value: { ...count.value, unpricedWhen: 'tokens' } }])),
    "unpricedWhen names column 'tokens'",
  ],
  [
    'a tab with tabs of its own',
    dashboardOf({ ...kpiDraft, kpis: { ...kpiDraft.kpis, tabs: [{ ...kpiDraft.kpis, tabs: [kpiDraft.kpis] }] } }),
    'Unrecognized key',
  ],
  [
    // Each tab is picked by its label, so a second tab with one would be unreachable.
    'two tabs with one label',
    dashboardOf({
      ...kpiDraft,
      kpis: { ...kpiDraft.kpis, label: 'Runs', tabs: [{ ...kpiDraft.kpis, label: 'Runs' }] },
    }),
    "another view is already labelled 'Runs'",
  ],
  [
    'two widgets with one id',
    dashboardOf(draftOf(agentRunsKpi), draftOf(agentRunsKpi)),
    "Duplicate widget id 'agent-runs'",
  ],
  [
    'more widgets than a dashboard holds',
    dashboardOf(...Array.from({ length: DASHBOARD_MAX_WIDGETS + 1 }, () => kpiDraft)),
    `At most ${DASHBOARD_MAX_WIDGETS} widgets`,
  ],
])('rejects %s, saying why, both from the tool and from toObservabilityDashboard', async (_, dashboard, message) => {
  const client = await connect();

  const result = await client.callTool({ name: 'showObservabilityDashboard', arguments: { dashboard } });

  expect(result.isError).toBe(true);
  expect(JSON.stringify(result.content)).toContain(message);
  expect(() => toObservabilityDashboard({ dashboard })).toThrow(message);
});

it("lists the catalog's metric names, rejects any other, and lists new ones once the tool is rebuilt", async () => {
  const { server } = observabilityServer();
  server.toolActions.add({ showObservabilityDashboard: dashboardToolFor(['mastra_agent_duration_ms']) });
  const client = await connect(server);
  const toolSchema = async () =>
    (await client.listTools()).tools.find(t => t.name === 'showObservabilityDashboard')!.inputSchema;
  const open = (metric: string) =>
    client.callTool({
      name: 'showObservabilityDashboard',
      arguments: {
        dashboard: {
          rows: [
            {
              widgets: [
                {
                  ...chartDraft,
                  timeseries: {
                    ...chart,
                    series: [
                      {
                        ...chart.series[0]!,
                        value: { metricTimeSeries: { ...runs.metricTimeSeries, name: [metric] } },
                      },
                    ],
                  },
                } as never,
              ],
            },
          ],
        },
      },
    });

  expect(metricNamesIn(await toolSchema())).toEqual(['"enum":["mastra_agent_duration_ms"]']);
  expect((await open('mastra_agent_duration_ms')).isError).toBeFalsy();
  const unknown = await open('mastra_model_total_input_tokens');
  expect(unknown.isError).toBe(true);
  expect(JSON.stringify(unknown.content)).toContain('mastra_agent_duration_ms');

  // A metric that starts recording after the tool was listed: rebuilding the tool lists it.
  server.toolActions.add({
    showObservabilityDashboard: dashboardToolFor(['mastra_model_total_input_tokens', 'mastra_agent_duration_ms']),
  });
  expect(metricNamesIn(await toolSchema())).toEqual([
    '"enum":["mastra_agent_duration_ms","mastra_model_total_input_tokens"]',
  ]);
  expect((await open('mastra_model_total_input_tokens')).isError).toBeFalsy();
});

it.each([
  ['no metric names', []],
  [
    'more metric names than are worth listing',
    Array.from({ length: OBSERVABILITY_CATALOG_MAX_METRIC_NAMES + 1 }, (_, i) => `mastra_metric_${i}`),
  ],
])('leaves metric names free with %s', async (_, metricNames) => {
  const { server } = observabilityServer();
  server.toolActions.add({ showObservabilityDashboard: dashboardToolFor(metricNames) });
  const client = await connect(server);

  const { tools } = await client.listTools();

  expect(metricNamesIn(tools.find(t => t.name === 'showObservabilityDashboard')!.inputSchema)).toEqual([]);
});

/**
 * Tools saving what a model writes, as a service storing dashboards builds them: both from one call,
 * for one catalog, offering only the kinds it stores and no dashboard-wide filters.
 */
function saveServer() {
  const schemas = createObservabilityDraftSchemas(
    { metricNames: ['mastra_agent_duration_ms'] },
    { kinds: ['kpis', 'timeseries', 'table'], dashboardFilters: false },
  );
  const stored = z.object({ stored: z.record(z.string(), z.unknown()) });
  return new MCPServer({
    id: 'dashboards',
    name: 'Dashboards',
    version: '1.0.0',
    tools: {
      addWidgetToDashboard: createTool({
        id: 'addWidgetToDashboard',
        description: 'Adds a widget to a dashboard',
        inputSchema: schemas.widget,
        outputSchema: stored,
        execute: async widget => ({ stored: toObservabilityWidget(widget) }),
      }),
      createDashboard: createTool({
        id: 'createDashboard',
        description: 'Creates a dashboard',
        inputSchema: schemas.dashboard,
        outputSchema: stored,
        execute: async dashboard => ({ stored: toObservabilityDashboard({ dashboard }).dashboard }),
      }),
    },
  });
}

it('offers the model only the kinds and defaults a service stores', async () => {
  const client = await connect(saveServer());

  const { tools } = await client.listTools();
  const schemaOf = (name: string) => tools.find(t => t.name === name)!.inputSchema as Record<string, any>;
  const widget = schemaOf('addWidgetToDashboard');
  const dashboard = schemaOf('createDashboard');

  expect(Object.keys(widget.properties)).toEqual(['id', 'span', 'title', 'description', 'kpis', 'timeseries', 'table']);
  expect(Object.keys(dashboard.properties.defaults.properties)).toEqual(['datePreset']);
  // Score reads stay on offer to KPIs and charts without the `scores` kind, their filters defined once.
  expect(JSON.stringify(widget).match(/"MastraScoreFilters":/g)).toHaveLength(1);
  expect(JSON.stringify(widget).match(/"MastraMetricFilters":/g)).toHaveLength(1);
});

const scoresDraft = {
  span: 12,
  scores: { average: { scorerId: ['relevance'] }, series: { scorerId: ['relevance'] } },
};
const [runsSeries] = chartDraft.timeseries.series;
const brokenChart = {
  ...chartDraft,
  timeseries: {
    ...chartDraft.timeseries,
    series: [runsSeries!, { ...runsSeries!, value: { metricTimeSeries: { name: ['x'] } } }],
  },
};

it.each<[string, string, Record<string, unknown>, string]>([
  ['a kind the service leaves out', 'addWidgetToDashboard', scoresDraft, 'not `scores`'],
  [
    'dashboard-wide filters',
    'createDashboard',
    { defaults: { filters: { entityName: 'agent' } }, rows: [{ widgets: [kpiDraft] }] },
    'Unrecognized key',
  ],
  [
    'a widget with a broken read, at its path in the draft',
    'addWidgetToDashboard',
    brokenChart,
    '- timeseries.series.1.value',
  ],
  [
    'a dashboard with a broken read, at its path in the draft',
    'createDashboard',
    dashboardOf(brokenChart),
    '- rows.0.widgets.0.timeseries.series.1.value',
  ],
  [
    'a widget whose tabs share a label, at the tab',
    'createDashboard',
    dashboardOf({
      ...kpiDraft,
      kpis: { ...kpiDraft.kpis, label: 'Runs', tabs: [{ ...kpiDraft.kpis, label: 'Runs' }] },
    }),
    "- rows.0.widgets.0.kpis.tabs.0: another view is already labelled 'Runs'",
  ],
])('rejects %s before saving', async (_, name, args, message) => {
  const client = await connect(saveServer());

  const result = await client.callTool({ name, arguments: args });

  expect(result.isError).toBe(true);
  expect(JSON.stringify(result.content)).toContain(message);
});

it('saves a widget with the id the model gave it, as a widget that renders', async () => {
  const client = await connect(saveServer());

  const result = await client.callTool({
    name: 'addWidgetToDashboard',
    arguments: { ...kpiDraft, id: 'pinned-1' },
  });

  expect(result.isError).toBeFalsy();
  const { stored } = result.structuredContent as { stored: DashboardWidget };
  expect(stored).toEqual({ ...agentRunsKpi, id: 'pinned-1' });
  expect(strictDashboardWidgetSchema.safeParse(stored).error?.issues).toBeUndefined();
});

it("throws a widget draft's issues at their paths in the draft, as the error's cause", () => {
  const draft = {
    ...chartDraft,
    timeseries: {
      ...chartDraft.timeseries,
      series: [chartDraft.timeseries.series[0]!, { ...chartDraft.timeseries.series[0]!, value: { const: 'one' } }],
    },
  } as never;

  let error: unknown;
  try {
    toObservabilityWidget(draft);
  } catch (e) {
    error = e;
  }

  expect((error as Error).message).toMatch(/^The widget is invalid:/);
  const cause = (error as Error).cause;
  expect(cause).toBeInstanceOf(z.ZodError);
  expect((cause as z.ZodError).issues.map(issue => issue.path.join('.'))).toContain('timeseries.series.1.value.const');
});

it('refuses to build schemas offering no kind', () => {
  expect(() => createObservabilityDraftSchemas({}, { kinds: [] })).toThrow('`kinds` must name at least one');
});

it('converts one widget as a dashboard converts it, with a fresh id and the full width when left out', () => {
  const { id: _id, span: _span, ...draft } = draftOf(agentRunsChart);

  const widget = toObservabilityWidget(draft);
  const { dashboard } = toObservabilityDashboard({ dashboard: { rows: [{ widgets: [draft] }] } });

  expect(widget).toEqual({ ...dashboard.rows[0]!.widgets[0], id: expect.any(String) });
  expect(widget.id).not.toBe(dashboard.rows[0]!.widgets[0]!.id);
  expect(widget.span).toBe(12);
  expect(toObservabilityWidget(draftOf(agentRunsKpi))).toEqual(agentRunsKpi);
});

it("refuses a widget that doesn't check, saying where from the widget", () => {
  const draft = { title: 'Spend', table: { groupBy: ['model'], columns: [] } } as never;

  expect(observabilityWidgetInputSchema.safeParse(draft).success).toBe(false);
  expect(() => toObservabilityWidget(draft)).toThrow(/^The widget is invalid:[\s\S]*table/);
  expect(() => toObservabilityWidget({ title: 'Two kinds', kpis: {}, table: {} } as never)).toThrow(/exactly one of/);
});

it("limits one widget's metric names to the catalog, as the dashboard schema does", () => {
  const schema = createObservabilityWidgetInputSchema({ metricNames: ['mastra_agent_duration_ms'] });

  expect(metricNamesIn(z.toJSONSchema(schema, { io: 'input' }))).toEqual(['"enum":["mastra_agent_duration_ms"]']);
  expect(schema.safeParse(draftOf(agentRunsKpi)).success).toBe(true);
  expect(metricNamesIn(z.toJSONSchema(observabilityWidgetInputSchema, { io: 'input' }))).toEqual([]);
});
