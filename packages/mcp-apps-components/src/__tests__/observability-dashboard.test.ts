import { DASHBOARD_MAX_WIDGETS, dashboardDefinitionSchema } from '@mastra/core/storage/dashboards';
import type { DashboardColumn, DashboardWidget, DashboardWidgetView } from '@mastra/core/storage/dashboards';
import { createTool } from '@mastra/core/tools';
import { METRICS_DASHBOARD } from '@mastra/playground-ui/domains/dashboards/metrics-dashboard';
import { afterEach, expect, it } from 'vitest';
import { z } from 'zod/v4';
import {
  OBSERVABILITY_CATALOG_MAX_METRIC_NAMES,
  createObservabilityDashboardInputSchema,
  createObservabilityWidgetInputSchema,
  observabilityDashboardOutputSchema,
  observabilityWidgetInputSchema,
  toObservabilityDashboard,
  toObservabilityWidget,
} from '../observability-dashboard';
import type { ObservabilityDashboardInput, ObservabilityWidgetDraft } from '../observability-dashboard';
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

it("advertises each kind's options to the model, with each read's arguments listed once", async () => {
  const client = await connect();

  const { tools } = await client.listTools();
  const tool = tools.find(t => t.name === 'showObservabilityDashboard')!;
  const schema = JSON.stringify(tool.inputSchema);

  expect(schema).toContain('"stackedBar"');
  expect(schema).toContain('"lowerIsBetter"');
  expect(schema.match(/"MastraMetricTimeSeriesRead":/g)).toHaveLength(1);
  // Nothing in a view points at anything else by id but `unpricedWhen`.
  expect(schema).not.toContain('"defaultSort"');
  expect(schema).not.toContain('"totals"');
  expect(schema).not.toContain('"dataKey"');
  // An unknown metric name reads as zero, so the model is told the ones Mastra emits.
  expect(schema).toContain('mastra_agent_duration_ms');
  expect(schema).toContain('mastra_model_total_input_tokens');
  // Small enough to sit in a model's tool list.
  expect(schema.length).toBeLessThan(100_000);
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
    expect(draftOf(opened!)).toEqual(draft);
    opened!.views.forEach((view, i) =>
      expect(view.queries.length).toBeLessThanOrEqual(widget.views[i]!.queries.length),
    );
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
    'A value takes exactly one of `metricAggregate`, `sum`, not `metricTimeSeries`',
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
