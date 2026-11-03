import type { DashboardWidget } from '@mastra/client-js';

/**
 * Widgets for Metrics cards that aren't on the Metrics page, so `METRICS_DASHBOARD` doesn't carry
 * them. The equality tests render each next to its card.
 */

const INPUT = 'mastra_model_total_input_tokens';
const OUTPUT = 'mastra_model_total_output_tokens';
const AGENT_DURATION = 'mastra_agent_duration_ms';

export const kpisWidget: DashboardWidget = {
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

export const scoresWidget: DashboardWidget = {
  id: 'scores',
  span: 12,
  kind: 'scores',
  title: 'Scores',
  description: 'Average scorer result, 0 to 1.',
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
