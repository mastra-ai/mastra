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

/** Two hourly buckets, for the 24h preset. */
export const hourlyInputTokenSeries: GetMetricTimeSeriesResponse = {
  series: [
    {
      name: 'mastra_model_total_input_tokens',
      costUnit: 'usd',
      points: [
        { timestamp: new Date('2026-06-01T13:45:00.000Z'), value: 120, estimatedCost: 0.001 },
        { timestamp: new Date('2026-06-01T00:05:00.000Z'), value: 80, estimatedCost: 0.002 },
      ],
    },
  ],
};

/** One output bucket, overlapping the first `inputTokenSeries` bucket, priced in eur. */
export const eurOutputTokenSeries: GetMetricTimeSeriesResponse = {
  series: [
    {
      name: 'mastra_model_total_output_tokens',
      costUnit: 'eur',
      points: [{ timestamp: new Date('2026-06-01T00:00:00.000Z'), value: 300, estimatedCost: 0.03 }],
    },
  ],
};

/** A priced series whose provider did not say what currency it is in. */
export const unpricedUnitOutputTokenSeries: GetMetricTimeSeriesResponse = {
  series: [
    {
      name: 'mastra_model_total_output_tokens',
      points: [{ timestamp: new Date('2026-06-01T00:00:00.000Z'), value: 300, estimatedCost: 0.03 }],
    },
  ] as GetMetricTimeSeriesResponse['series'],
};

/** Token counts with no cost attached at all. */
export const costlessInputTokenSeries: GetMetricTimeSeriesResponse = {
  series: [
    {
      name: 'mastra_model_total_input_tokens',
      costUnit: 'usd',
      points: [{ timestamp: new Date('2026-06-01T00:00:00.000Z'), value: 500 }],
    },
  ] as GetMetricTimeSeriesResponse['series'],
};

/** One usable bucket and one the backend could not stamp. */
export const partlyUnstampedInputTokenSeries: GetMetricTimeSeriesResponse = {
  series: [
    {
      name: 'mastra_model_total_input_tokens',
      costUnit: 'usd',
      points: [
        { timestamp: 'not-a-date', value: 999 },
        { timestamp: new Date('2026-06-01T00:00:00.000Z'), value: 500 },
      ],
    },
  ] as unknown as GetMetricTimeSeriesResponse['series'],
};

/** A response that carries no series at all. */
export const noTokenSeries: GetMetricTimeSeriesResponse = { series: [] };
