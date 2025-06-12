import type { TestInfo, MetricResult } from '@mastra/core/eval';

import { client } from '@/lib/client';
import { useQuery } from '@tanstack/react-query';

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

export const useEvalsByAgentId = (agentId: string, type: 'ci' | 'live') => {
  return useQuery({
    staleTime: 0,
    gcTime: 0,
    queryKey: ['evals', agentId, type],
    queryFn: () => (type === 'live' ? client.getAgent(agentId).liveEvals() : client.getAgent(agentId).evals()),
  });
};
