import { useMastraClient } from '@mastra/react';
import { useMutation } from '@tanstack/react-query';

interface TriggerScoreArgs {
  scorerName: string;
  traceId: string;
  spanId?: string;
}

export const useTriggerScorer = () => {
  const client = useMastraClient();

  return useMutation({
    mutationFn: async ({ scorerName, traceId, spanId }: TriggerScoreArgs) => {
      const response = await client.score({
        scorerName,
        targets: [{ traceId, spanId }],
      });

      return response;
    },
  });
};
