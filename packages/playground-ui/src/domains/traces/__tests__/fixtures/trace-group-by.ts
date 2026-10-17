import type { AggregateTracesResponse } from '@mastra/client-js';

export const groupedByEntityName: AggregateTracesResponse = {
  rows: [
    {
      dimensions: { entityName: 'support-agent' },
      measures: {
        count: 12,
        errorRate: 0.25,
        'duration.p50': 850,
        'duration.p95': 2400,
        'tokens.input.sum': 15200,
        'tokens.output.sum': 4100,
        'cost.sum': 1.234,
      },
      cost: { coverage: 0.62, unit: 'USD' },
    },
    {
      dimensions: { entityName: 'triage-workflow' },
      measures: {
        count: 3,
        errorRate: 0,
        'duration.p50': 120,
        'duration.p95': 300,
        'tokens.input.sum': null,
        'tokens.output.sum': null,
        'cost.sum': null,
      },
      cost: { coverage: null, unit: null },
    },
    {
      dimensions: { entityName: 'billing-agent' },
      measures: {
        count: 2,
        errorRate: 0.5,
        'duration.p50': 1000,
        'duration.p95': 1500,
        'tokens.input.sum': 900,
        'tokens.output.sum': 300,
        'cost.sum': null,
      },
      cost: { coverage: 1, unit: 'mixed' },
    },
    {
      dimensions: { entityName: null },
      measures: {
        count: 1,
        errorRate: 1,
        'duration.p50': 40,
        'duration.p95': 40,
        'tokens.input.sum': null,
        'tokens.output.sum': null,
        'cost.sum': null,
      },
      cost: { coverage: null, unit: null },
    },
  ],
  truncated: false,
};

export const groupedByStatus: AggregateTracesResponse = {
  rows: [
    {
      dimensions: { status: 'success' },
      measures: {
        count: 9,
        errorRate: 0,
        'duration.p50': 500,
        'duration.p95': 900,
        'tokens.input.sum': 100,
        'tokens.output.sum': 50,
        'cost.sum': 0.5,
      },
      cost: { coverage: 1, unit: 'USD' },
    },
  ],
  truncated: true,
};
