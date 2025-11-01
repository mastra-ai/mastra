import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GetScorerResponse, ListScoresResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useScoresByEntityId = (entityId: string, entityType: string, page: number = 0) => {
  const client = useMastraClient();
  const [scores, setScores] = useState<ListScoresResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchScores = async () => {
      setIsLoading(true);
      try {
        const res = await client.listScoresByEntityId({
          entityId,
          entityType,
          page: page || 0,
          perPage: 10,
        });
        setScores(res);
        setIsLoading(false);
      } catch (error) {
        setScores(null);
        setIsLoading(false);
      }
    };

    fetchScores();
  }, [entityId, entityType, page]);

  return { scores, isLoading };
};

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

  useEffect(() => {
    const fetchScorer = async () => {
      setIsLoading(true);
      try {
        const res = await client.getScorer(scorerId);
        setScorer(res);
      } catch (error) {
        setScorer(null);
        console.error('Error fetching scorer', error);
        toast.error('Error fetching scorer');
      } finally {
        setIsLoading(false);
      }
    };

    fetchScorer();
  }, [scorerId]);

  return { scorer, isLoading };
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
