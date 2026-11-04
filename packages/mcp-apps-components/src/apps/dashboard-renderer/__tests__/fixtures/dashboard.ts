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

type TimeSeriesResponse = Awaited<ReturnType<MastraClient['getMetricTimeSeries']>>;

/** A chart whose action opens the traces of the `support` agent. */
export const supportRunsChart: DashboardDefinition = {
  schemaVersion: 1,
  rows: [
    {
      widgets: [
        {
          id: 'support-runs',
          span: 12,
          kind: 'timeseries',
          title: 'Support runs',
          drilldown: { action: { page: 'traces', filters: [{ fieldId: 'entityName', value: 'support' }] } },
          views: [
            {
              queries: [
                {
                  id: 'runs',
                  source: 'metrics',
                  request: 'timeSeries',
                  name: ['mastra_agent_duration_ms'],
                  aggregation: 'count',
                },
              ],
              options: {
                chart: 'line',
                format: 'count',
                series: [{ dataKey: 'runs', label: 'Runs', color: 'green', value: { query: 'runs' } }],
              },
            },
          ],
        },
      ],
    },
  ],
};

export const emptyTimeSeries: TimeSeriesResponse = { series: [] };

type ListScoresResponse = Awaited<ReturnType<MastraClient['listScores']>>;

/** A scores widget that names no scorer, so it lists the range's recent scores to find them. */
export const discoveredScoresDashboard: DashboardDefinition = {
  schemaVersion: 1,
  rows: [
    {
      widgets: [
        {
          id: 'scores',
          span: 12,
          kind: 'scores',
          title: 'Scores',
          views: [
            {
              queries: [
                { id: 'average', source: 'scores', request: 'aggregate', aggregation: 'avg' },
                { id: 'series', source: 'scores', request: 'timeSeries', aggregation: 'avg' },
              ],
              options: { average: 'average', series: 'series', emptyMessage: 'No scores in this range.' },
            },
          ],
        },
      ],
    },
  ],
};

export const emptyScores: ListScoresResponse = {
  pagination: { total: 0, page: 0, perPage: 100, hasMore: false },
  scores: [],
};
