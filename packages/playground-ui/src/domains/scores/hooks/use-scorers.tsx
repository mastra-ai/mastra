import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GetScorerResponse, GetScoresResponse } from '@mastra/client-js';
import { useMastraClient } from '@/contexts/mastra-client-context';

export const useScoresByEntityId = (entityId: string, entityType: string, page: number = 0) => {
  const client = useMastraClient();
  const [scores, setScores] = useState<GetScoresResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchScores = async () => {
      setIsLoading(true);
      try {
        const res = await client.getScoresByEntityId({
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
  const [scores, setScores] = useState<GetScoresResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchScores = async () => {
      setIsLoading(true);
      try {
        const res = await client.getScoresByScorerId({
          scorerId,
          page: page || 0,
          entityId: entityId || undefined,
          entityType: entityType || undefined,
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
  }, [scorerId, page, entityId, entityType]);

  return { scores, isLoading };
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
  const [scorers, setScorers] = useState<Record<string, GetScorerResponse>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchScorers = async () => {
      setIsLoading(true);
      try {
        const res = await client.getScorers();
        setScorers(res);
      } catch (error) {
        setScorers({});
        console.error('Error fetching agents', error);
        toast.error('Error fetching agents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchScorers();
  }, []);

  return { scorers, isLoading };
};
