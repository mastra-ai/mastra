import type { AggregateSpansArgs, AggregateSpansResponse } from '@mastra/client-js';

export const agentRunsByEntityNameRequest = {
  timeRange: { from: '2026-10-08T00:00:00.000Z', to: '2026-10-15T00:00:00.000Z' },
  where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'agent_run' } },
  groupBy: ['entityName'],
  measures: ['count', 'errorRate', 'duration.p95'],
  orderBy: { field: 'count', direction: 'desc' },
  limit: 50,
} satisfies AggregateSpansArgs;

export const agentRunsByEntityNameResponse = {
  rows: [
    {
      dimensions: { entityName: 'support-agent' },
      measures: { count: 40, errorRate: 0.05, 'duration.p95': 8200 },
      cost: { coverage: null, unit: null },
    },
    {
      dimensions: { entityName: 'summarizer' },
      measures: { count: 31, errorRate: 0, 'duration.p95': 1300 },
      cost: { coverage: null, unit: null },
    },
  ],
  truncated: false,
} satisfies AggregateSpansResponse;
