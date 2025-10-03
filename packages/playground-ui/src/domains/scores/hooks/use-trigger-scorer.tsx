import { useMastraClient } from '@mastra/react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

interface TriggerScoreArgs {
  scorerName: string;
  traceId: string;
  spanId?: string;
}

export const useTriggerScorer = (onScorerTriggered: (scorerName: string, traceId: string, spanId?: string) => void) => {
  const client = useMastraClient();

  return useMutation({
    mutationFn: async ({ scorerName, traceId, spanId }: TriggerScoreArgs) => {
      const response = await client.score({
        scorerName,
        targets: [{ traceId, spanId }],
      });

      return response;
    },
    // onSuccess: (_, variables) => {
    //   toast.success('Scorer triggered successfully');
    //   onScorerTriggered(variables.scorerName, variables.traceId, variables.spanId);
    // },
    // onError: () => {
    //   toast.error('Error triggering scorer');
    // },
  });
};
