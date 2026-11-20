import type { ExperimentItemUsage } from '@mastra/react/hooks/experiments';

/** Usage of one agent trace: 60 in + 40 out tokens, $0.001. */
export const agentTraceUsage: ExperimentItemUsage = {
  inputTokens: 60,
  outputTokens: 40,
  estimatedCost: 0.001,
  costUnit: 'usd',
};
