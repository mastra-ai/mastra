import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const useEvalsByAgentId = (agentId: string) => {
  const [evals, setEvals] = useState<
    {
      result: {
        score: number;
      };
      meta: {
        metricName: string;
        runId: string;
      };
    }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvals = async (_agentId?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/agents/${_agentId ?? agentId}/evals`);
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
