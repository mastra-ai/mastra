import type { MastraClient } from '@mastra/client-js';

type TraceUsageBreakdownResponse = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;

export const traceUsageBreakdown = {
  groups: [
    {
      dimensions: { traceId: 'trace-a', name: 'mastra_model_total_input_tokens' },
      value: 100,
      estimatedCost: 0.001,
      costUnit: 'usd',
    },
    {
      dimensions: { traceId: 'trace-b', name: 'mastra_model_total_input_tokens' },
      value: 200,
      estimatedCost: 0.002,
      costUnit: 'usd',
    },
    {
      dimensions: { traceId: 'trace-a', name: 'mastra_model_total_output_tokens' },
      value: 30,
      estimatedCost: 0.003,
      costUnit: 'usd',
    },
    {
      dimensions: { traceId: 'trace-b', name: 'mastra_model_total_output_tokens' },
      value: 40,
      estimatedCost: 0.004,
      costUnit: 'usd',
    },
  ],
} satisfies TraceUsageBreakdownResponse;

export const mixedCostUnitBreakdown = {
  groups: [
    {
      dimensions: { traceId: 'trace-a', name: 'mastra_model_total_input_tokens' },
      value: 100,
      estimatedCost: 0.001,
      costUnit: 'usd',
    },
    {
      dimensions: { traceId: 'trace-a', name: 'mastra_model_total_output_tokens' },
      value: 30,
      estimatedCost: 0.003,
      costUnit: 'eur',
    },
  ],
} satisfies TraceUsageBreakdownResponse;

export const emptyTraceUsageBreakdown = {
  groups: [],
} satisfies TraceUsageBreakdownResponse;
