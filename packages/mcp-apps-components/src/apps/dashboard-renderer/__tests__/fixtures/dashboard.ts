import type { DashboardDefinition, MastraClient } from '@mastra/client-js';

type AggregateResponse = Awaited<ReturnType<MastraClient['getMetricAggregate']>>;

export const agentRunsDashboard: DashboardDefinition = {
  schemaVersion: 1,
  rows: [
    {
      widgets: [
        {
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
                  name: ['mastra_agent_duration_ms'],
                  aggregation: 'count',
                  compare: 'previousWindow',
                },
              ],
              options: {
                items: [
                  {
                    label: 'Agent runs',
                    icon: 'bot',
                    format: 'count',
                    value: { query: 'runs' },
                    detail: 'in this range',
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
};

export const agentRunsAggregate: AggregateResponse = {
  value: 693,
  previousValue: 891,
  changePercent: -22.2,
};
