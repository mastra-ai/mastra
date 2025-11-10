import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GetScorerResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

type UseScoresByScorerIdProps = {
  scorerId: string;
  page?: number;
  entityId?: string;
  entityType?: string;
};

export const useScoresByScorerId = ({ scorerId, page = 0, entityId, entityType }: UseScoresByScorerIdProps) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['scores', scorerId, page, entityId, entityType],
    queryFn: () => client.listScoresByScorerId({ scorerId, page, entityId, entityType, perPage: 10 }),
    refetchInterval: 5000,
  });
};

export const useScorer = (scorerId: string) => {
  const client = useMastraClient();
  const [scorer, setScorer] = useState<GetScorerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchScorer = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await client.getScorer(scorerId);
        setScorer(res);
      } catch (error) {
        setScorer(null);
        const errorObj = error instanceof Error ? error : new Error('Error fetching scorer');
        setError(errorObj);
        console.error('Error fetching scorer', error);
        toast.error('Error fetching scorer');
      } finally {
        setIsLoading(false);
      }
    };

    fetchScorer();
  }, [scorerId]);

  return { scorer, isLoading, error };
};

export const useScorers = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['scorers'],
    queryFn: () => client.listScorers(),
    staleTime: 0,
    gcTime: 0,
  });
};
