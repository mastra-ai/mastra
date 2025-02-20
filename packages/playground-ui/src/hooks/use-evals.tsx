import type { TestInfo, MetricResult } from '@mastra/core/eval';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { mastraClient } from '@/lib/mastra-client';

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

export const useEvalsByAgentId = (agentId: string, type: 'ci' | 'live', baseUrl?: string) => {
  const [evals, setEvals] = useState<Evals[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvals = async (_agentId?: string) => {
    setIsLoading(true);
    const activeAgentId = _agentId ?? agentId;
    try {
      const res =
        type === 'live'
          ? await mastraClient(baseUrl).getAgent(activeAgentId).liveEvals()
          : await mastraClient(baseUrl).getAgent(activeAgentId).evals();

      setEvals(res.evals);
    } catch (error) {
      setEvals([]);
      console.error('Error fetching evals', error);
      toast.error('Error fetching evals');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvals(agentId);
  }, [agentId]);

  return { evals, isLoading, refetchEvals: fetchEvals };
};
