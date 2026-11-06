import { DASHBOARD_MAX_WIDGETS, dashboardDefinitionSchema } from '@mastra/core/storage/dashboards';
import { afterEach, expect, it } from 'vitest';
import { toObservabilityDashboard } from '../observability-dashboard';
import type { ObservabilityDashboardInput } from '../observability-dashboard';
import { serveAndConnect } from './greeting-server';
import { agentRunsChart, agentRunsKpi, observabilityServer } from './observability-server';

const hosts: Awaited<ReturnType<typeof serveAndConnect>>[] = [];
afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.close()));
});

async function connect() {
  const host = await serveAndConnect(observabilityServer().server);
  hosts.push(host);
  return host.client;
}

const { id: _id, ...kpiDraft } = agentRunsKpi;

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
  // Small enough to sit in a model's tool list.
  expect(schema.length).toBeLessThan(100_000);
});

it('opens through the tool with missing ids assigned and given ids kept', async () => {
  const client = await connect();

  const result = await client.callTool({
    name: 'showObservabilityDashboard',
    arguments: {
      dashboard: { rows: [{ widgets: [kpiDraft, kpiDraft] }, { widgets: [agentRunsChart] }] },
      datePreset: '14d',
    } satisfies ObservabilityDashboardInput,
  });

  expect(result.isError).toBeFalsy();
  const opened = result.structuredContent as ReturnType<typeof toObservabilityDashboard>;
  expect(opened.datePreset).toBe('14d');
  expect(dashboardDefinitionSchema.safeParse(opened.dashboard).success).toBe(true);
  const [first, second, chart] = widgets(opened);
  expect(first).toMatchObject(kpiDraft);
  // The same widget twice gets two ids, so each can be pinned on its own.
  expect(first!.id).toEqual(expect.any(String));
  expect(first!.id).not.toBe(second!.id);
  expect(chart!.id).toBe(agentRunsChart.id);
});

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
              ...agentRunsKpi,
              kind: 'kpis',
              views: [
                {
                  ...agentRunsKpi.views[0]!,
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
              ],
            } as never,
          ],
        },
      ],
    },
    "reads query 'missing', which the view doesn't have",
  ],
  ['a kind no renderer draws', { rows: [{ widgets: [{ ...agentRunsKpi, kind: 'pie' } as never] }] }, 'kind'],
  [
    'two widgets with one id',
    { rows: [{ widgets: [agentRunsKpi as never, agentRunsKpi as never] }] },
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
