import { useMastraClient } from '@/contexts/mastra-client-context';
import { useMutation } from '@tanstack/react-query';

export const useTriggerScorer = (scorerName: string, traceId: string, spanId?: string) => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: async () => {
      const response = await client.score(scorerName, traceId, spanId);
    },
  });
};
