import type { GetMetricTimeSeriesResponse } from '@mastra/client-js';
import type { MetricsRequest } from '../msw-handlers';

export const emptyTimeSeries: GetMetricTimeSeriesResponse = { series: [] };

const inputTokenSeries: GetMetricTimeSeriesResponse = {
  series: [
    {
      name: 'mastra_model_total_input_tokens',
      costUnit: 'usd',
      points: [
        { timestamp: '2026-06-01T00:00:00.000Z', value: 1200, estimatedCost: 0.012 },
        { timestamp: '2026-06-02T00:00:00.000Z', value: 800, estimatedCost: 0.008 },
      ],
    },
  ],
};

const outputTokenSeries: GetMetricTimeSeriesResponse = {
  series: [
    {
      name: 'mastra_model_total_output_tokens',
      costUnit: 'usd',
      points: [
        { timestamp: '2026-06-01T00:00:00.000Z', value: 300, estimatedCost: 0.03 },
        { timestamp: '2026-06-02T00:00:00.000Z', value: 200, estimatedCost: 0.02 },
      ],
    },
  ],
};

export const tokenUsageTimeSeries = ({ name }: MetricsRequest): GetMetricTimeSeriesResponse =>
  name[0] === 'mastra_model_total_output_tokens' ? outputTokenSeries : inputTokenSeries;
