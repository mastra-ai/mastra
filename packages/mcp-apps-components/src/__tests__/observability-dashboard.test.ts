import { DASHBOARD_MAX_WIDGETS, dashboardDefinitionSchema } from '@mastra/core/storage/dashboards';
import { createTool } from '@mastra/core/tools';
import { METRICS_DASHBOARD } from '@mastra/playground-ui/domains/dashboards/metrics-dashboard';
import { afterEach, expect, it } from 'vitest';
import {
  OBSERVABILITY_CATALOG_MAX_METRIC_NAMES,
  createObservabilityDashboardInputSchema,
  observabilityDashboardOutputSchema,
  toObservabilityDashboard,
} from '../observability-dashboard';
import type { ObservabilityDashboardInput } from '../observability-dashboard';
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
  const query = (inputSchema as { $defs: Record<string, unknown> }).$defs.MastraDashboardQuery;
  const names = JSON.stringify(query).match(/"enum":\["mastra_[^\]]*\]/g) ?? [];
  return [...new Set(names)];
};

const { id: _id, ...kpiDraft } = draftOf(agentRunsKpi);
const chartDraft = draftOf(agentRunsChart);

const widgets = (opened: ReturnType<typeof toObservabilityDashboard>) =>
  opened.dashboard.rows.flatMap(row => row.widgets);

it("advertises each kind's options to the model, with the shared query schema listed once", async () => {
  const client = await connect();

  const { tools } = await client.listTools();
  const tool = tools.find(t => t.name === 'showObservabilityDashboard')!;
  const schema = JSON.stringify(tool.inputSchema);

  expect(schema).toContain('"stackedBar"');
  expect(schema).toContain('"lowerIsBetter"');
  expect(schema.match(/"MastraDashboardQuery":/g)).toHaveLength(1);
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

it('names each case by a key holding its fields, and opens to the stored definition', () => {
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
                queries: [
                  {
                    id: 'runs',
                    metricTimeSeries: { name: ['mastra_agent_duration_ms'], aggregation: 'count', groupBy: ['status'] },
                  },
                ],
                options: {
                  chart: 'stackedBar',
                  format: 'count',
                  series: [{ dataKey: 'runs', label: 'Runs', color: 'green', value: { query: 'runs' } }],
                },
              },
            },
          ],
        },
      ],
    },
  });

  expect(widgets(opened)).toEqual([agentRunsChart]);
});

it.each(METRICS_DASHBOARD.rows.flatMap(row => row.widgets).map(widget => [widget.id, widget] as const))(
  "opens Studio's %s widget, written as a draft, to the same widget",
  (_, widget) => {
    const opened = toObservabilityDashboard({ dashboard: { rows: [{ widgets: [draftOf(widget)] }] } });

    expect(widgets(opened)).toEqual([widget]);
  },
);

it("gives a fresh id on every open, so a widget doesn't collide with the one pinned last time", () => {
  const input: ObservabilityDashboardInput = { dashboard: { rows: [{ widgets: [kpiDraft] }] } };

  const [a] = widgets(toObservabilityDashboard(input));
  const [b] = widgets(toObservabilityDashboard(input));

  expect(a!.id).not.toBe(b!.id);
});

it.each<[string, ObservabilityDashboardInput['dashboard'], string]>([
  [
    'a KPI reading a query its view lacks',
    {
      rows: [
        {
          widgets: [
            {
              ...kpiDraft,
              kpis: {
                ...kpiDraft.kpis!,
                options: {
                  items: [
                    {
                      label: 'Runs',
                      icon: 'bot',
                      format: 'count',
                      value: { query: 'missing' },
                      detail: 'in this range',
                    },
                  ],
                },
              },
            } as never,
          ],
        },
      ],
    },
    "reads query 'missing', which the view doesn't have",
  ],
  [
    'a kind no renderer draws',
    { rows: [{ widgets: [{ span: 12, pie: kpiDraft.kpis } as never] }] },
    'A widget takes exactly one of `kpis`, `timeseries`, `table`, `scores`',
  ],
  [
    'a widget of two kinds',
    { rows: [{ widgets: [{ ...kpiDraft, scores: kpiDraft.kpis } as never] }] },
    'not `kpis`, `scores`',
  ],
  [
    'a chart query setting its own interval',
    {
      rows: [
        {
          widgets: [
            {
              ...chartDraft,
              timeseries: {
                ...chartDraft.timeseries!,
                queries: [
                  {
                    id: 'runs',
                    metricTimeSeries: { ...chartDraft.timeseries!.queries[0]!.metricTimeSeries!, interval: '1h' },
                  } as never,
                ],
              },
            },
          ],
        },
      ],
    },
    'interval',
  ],
  [
    'two widgets with one id',
    { rows: [{ widgets: [draftOf(agentRunsKpi), draftOf(agentRunsKpi)] }] },
    "Duplicate widget id 'agent-runs'",
  ],
  [
    'more widgets than a dashboard holds',
    {
      rows: [
        {
          widgets: Array.from({ length: DASHBOARD_MAX_WIDGETS + 1 }, () => kpiDraft),
        },
      ],
    },
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
  const open = (name: string) =>
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
                    ...chartDraft.timeseries!,
                    queries: [
                      {
                        id: 'runs',
                        metricTimeSeries: { ...chartDraft.timeseries!.queries[0]!.metricTimeSeries!, name: [name] },
                      } as never,
                    ],
                  },
                },
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
