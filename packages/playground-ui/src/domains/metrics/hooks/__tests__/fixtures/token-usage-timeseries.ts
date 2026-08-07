import type { GetMetricTimeSeriesResponse } from '@mastra/client-js';

export const inputTokenSeries: GetMetricTimeSeriesResponse = {
  series: [
    {
      name: 'mastra_model_total_input_tokens',
      costUnit: 'usd',
      points: [
        {
          timestamp: new Date('2026-06-01T00:00:00.000Z'),
          value: 1200,
          estimatedCost: 0.012,
        },
        {
          timestamp: new Date('2026-06-02T00:00:00.000Z'),
          value: 800,
          estimatedCost: 0.008,
        },
      ],
    },
  ],
};

export const outputTokenSeries: GetMetricTimeSeriesResponse = {
  series: [
    {
      name: 'mastra_model_total_output_tokens',
      costUnit: 'usd',
      points: [
        {
          timestamp: new Date('2026-06-01T00:00:00.000Z'),
          value: 300,
          estimatedCost: 0.03,
        },
        {
          timestamp: new Date('2026-06-03T00:00:00.000Z'),
          value: 200,
          estimatedCost: 0.02,
        },
      ],
    },
  ],
};

export const emptyTokenSeries: GetMetricTimeSeriesResponse = {
  series: [
    {
      name: 'mastra_model_total_input_tokens',
      costUnit: 'usd',
      points: [],
    },
  ],
};
