import type { MastraClient } from '@mastra/client-js';

type MetricBreakdownResponse = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;

/** `POST /api/observability/metrics/breakdown` for `agentTracedResult`: 1,200 in + 300 out tokens, $0.0015. */
export const experimentUsageBreakdown: MetricBreakdownResponse = {
  groups: [
    {
      dimensions: { traceId: 'trace-res-agent-traced', name: 'mastra_model_total_input_tokens' },
      value: 1200,
      estimatedCost: 0.001,
      costUnit: 'usd',
    },
    {
      dimensions: { traceId: 'trace-res-agent-traced', name: 'mastra_model_total_output_tokens' },
      value: 300,
      estimatedCost: 0.0005,
      costUnit: 'usd',
    },
  ],
};

/** Experiment totals across two traces: 9,900 in + 2,500 out tokens = 12,400, $0.0123. */
export const experimentTotalsBreakdown: MetricBreakdownResponse = {
  groups: [
    {
      dimensions: { traceId: 'trace-a', name: 'mastra_model_total_input_tokens' },
      value: 6000,
      estimatedCost: 0.006,
      costUnit: 'usd',
    },
    {
      dimensions: { traceId: 'trace-a', name: 'mastra_model_total_output_tokens' },
      value: 1500,
      estimatedCost: 0.0015,
      costUnit: 'usd',
    },
    {
      dimensions: { traceId: 'trace-b', name: 'mastra_model_total_input_tokens' },
      value: 3900,
      estimatedCost: 0.0039,
      costUnit: 'usd',
    },
    {
      dimensions: { traceId: 'trace-b', name: 'mastra_model_total_output_tokens' },
      value: 1000,
      estimatedCost: 0.0009,
      costUnit: 'usd',
    },
  ],
};

export const emptyUsageBreakdown: MetricBreakdownResponse = { groups: [] };
