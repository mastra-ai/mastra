import type { ExperimentItemUsage } from '@mastra/react/hooks/experiments';

/** Usage of one agent trace: 60 in + 40 out tokens, $0.001. */
export const agentTraceUsage: ExperimentItemUsage = {
  inputTokens: 60,
  outputTokens: 40,
  estimatedCost: 0.001,
  costUnit: 'usd',
};

/** Usage of `agentTracedResult`'s trace: 1,200 in + 300 out tokens, $0.0015. */
export const tracedItemUsage: ExperimentItemUsage = {
  inputTokens: 1200,
  outputTokens: 300,
  estimatedCost: 0.0015,
  costUnit: 'usd',
};

/** Experiment totals: 9,900 in + 2,500 out tokens = 12,400, $0.0123. */
export const experimentTotalsUsage: ExperimentItemUsage = {
  inputTokens: 9900,
  outputTokens: 2500,
  estimatedCost: 0.0123,
  costUnit: 'usd',
};
