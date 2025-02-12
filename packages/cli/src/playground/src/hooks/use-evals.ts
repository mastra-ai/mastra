import type { TestInfo, MetricResult } from '@mastra/core/eval';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

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
  const [evals, setEvals] = useState<Evals[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvals = async (_agentId?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/agents/${_agentId ?? agentId}/evals/${type}`);
      if (!res.ok) {
        const error = await res.json();
        setEvals([]);
        console.error('Error fetching evals', error);
        toast.error(error?.error || 'Error fetching evals');
        return;
      }
      const data = await res.json();
      setEvals(data.evals);
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
