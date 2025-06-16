import type { TestInfo, MetricResult } from '@mastra/core/eval';

export type Evals = {
  input: string;
  output: string;
  result: MetricResult;
  agentName: string;
  createdAt: string;
  metricName: string;
  instructions: string;
  runId: string;
  globalRunId: string;
  testInfo?: TestInfo;
};

export type GroupedEvals = {
  metricName: string;
  averageScore: number;
  evals: Evals[];
};

export type SortDirection = 'asc' | 'desc';

export type SortConfig = {
  field: keyof GroupedEvals | 'timestamp' | 'score';
  direction: SortDirection;
};
