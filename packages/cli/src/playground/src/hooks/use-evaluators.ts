import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GetEvaluatorResponse } from '@mastra/client-js';
import { client } from '@/lib/client';

export const useEvaluators = () => {
  const [evaluators, setEvaluators] = useState<Record<string, GetEvaluatorResponse>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvaluators = async () => {
      setIsLoading(true);
      try {
        const res = await client.getEvaluators();
        setEvaluators(res);
      } catch (error) {
        setEvaluators({});
        console.error('Error fetching evaluators', error);
        toast.error('Error fetching evaluators');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvaluators();
  }, []);

  return { evaluators, isLoading };
};

export const useEvaluator = (evaluatorId: string) => {
  const [evaluators, setEvaluators] = useState<Record<string, GetEvaluatorResponse>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvaluators = async () => {
      setIsLoading(true);
      try {
        const res = await client.getEvaluators();
        setEvaluators(res);
      } catch (error) {
        setEvaluators({});
        console.error('Error fetching evaluators', error);
        toast.error('Error fetching evaluators');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvaluators();
  }, []);

  const evaluator = evaluators[evaluatorId];

  return { evaluator, isLoading };
};
