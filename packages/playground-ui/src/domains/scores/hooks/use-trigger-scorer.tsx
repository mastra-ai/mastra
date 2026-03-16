import { useMastraClient } from '@mastra/react';
import { useMutation } from '@tanstack/react-query';

interface TriggerScoreArgs {
  scorerId: string;
  traceId: string;
  spanId?: string;
}

export const useTriggerScorer = () => {
  const client = useMastraClient();

  return useMutation({
    mutationFn: async ({ scorerId, traceId, spanId }: TriggerScoreArgs) => {
      const response = await client.score({
        scorerId,
        targets: [{ traceId, spanId }],
      });

      return response;
    },
  });
};
