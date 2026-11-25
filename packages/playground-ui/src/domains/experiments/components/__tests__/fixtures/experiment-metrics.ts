import type { ExperimentMetrics } from '@mastra/react/hooks/experiments';

/** Cost and tokens come from item usage; the KPIs only read the average duration from metrics. */
export const experimentMetrics: ExperimentMetrics = {
  totalTokens: null,
  estimatedCost: null,
  costUnit: null,
  avgAgentDurationMs: 1850,
  agentRuns: 42,
};
