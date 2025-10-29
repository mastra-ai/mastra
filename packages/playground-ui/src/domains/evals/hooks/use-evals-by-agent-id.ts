import type { TestInfo, MetricResult } from '@mastra/core/eval';

import { useQuery } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';
import { useMastraClient } from '@mastra/react';

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
  const { requestContext } = usePlaygroundStore();
  const client = useMastraClient();
  return useQuery({
    staleTime: 0,
    gcTime: 0,
    queryKey: ['evals', agentId, type, JSON.stringify(requestContext)],
    queryFn: () =>
      type === 'live'
        ? client.getAgent(agentId).liveEvals(requestContext)
        : client.getAgent(agentId).evals(requestContext),
  });
};
