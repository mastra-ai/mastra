import type { AggregateTracesArgs, AggregateTracesResponse } from '@mastra/client-js';

export const groupedByEntityNameRequest = {
  timeRange: { from: '2026-10-08T00:00:00.000Z', to: '2026-10-15T00:00:00.000Z' },
  where: { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
  groupBy: ['entityName'],
  measures: ['count', 'errorRate', 'cost.sum'],
  orderBy: { field: 'count', direction: 'desc' },
  limit: 50,
} satisfies AggregateTracesArgs;

export const groupedByEntityNameResponse = {
  rows: [
    {
      dimensions: { entityName: 'support-agent' },
      measures: { count: 12, errorRate: 0.25, 'cost.sum': 0.42 },
      cost: { coverage: 1, unit: 'USD' },
    },
    {
      dimensions: { entityName: 'triage-workflow' },
      measures: { count: 3, errorRate: 0, 'cost.sum': null },
      cost: { coverage: null, unit: null },
    },
  ],
  truncated: false,
} satisfies AggregateTracesResponse;
