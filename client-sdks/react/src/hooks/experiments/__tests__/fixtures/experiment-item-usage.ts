import type { MastraClient } from '@mastra/client-js';

type MetricBreakdownResponse = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;

const INPUT = 'mastra_model_total_input_tokens';
const OUTPUT = 'mastra_model_total_output_tokens';

export const BASELINE_EXPERIMENT_ID = 'exp-baseline';
export const CONTENDER_EXPERIMENT_ID = 'exp-contender';

export const baselineBreakdown: MetricBreakdownResponse = {
  groups: [
    { dimensions: { traceId: 'trace-b1', name: INPUT }, value: 100, estimatedCost: 0.001, costUnit: 'usd' },
    { dimensions: { traceId: 'trace-b1', name: OUTPUT }, value: 40, estimatedCost: 0.002, costUnit: 'usd' },
    { dimensions: { traceId: 'trace-b2', name: INPUT }, value: 70, estimatedCost: null, costUnit: null },
  ],
};

export const contenderBreakdown: MetricBreakdownResponse = {
  groups: [
    { dimensions: { traceId: 'trace-c1', name: INPUT }, value: 200, estimatedCost: 0.004, costUnit: 'usd' },
    { dimensions: { traceId: 'trace-c1', name: OUTPUT }, value: 80, estimatedCost: 0.003, costUnit: 'eur' },
  ],
};

export const breakdownByExperimentId: Record<string, MetricBreakdownResponse> = {
  [BASELINE_EXPERIMENT_ID]: baselineBreakdown,
  [CONTENDER_EXPERIMENT_ID]: contenderBreakdown,
};
