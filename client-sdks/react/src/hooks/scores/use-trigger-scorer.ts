import type { MastraClient } from '@mastra/client-js';
import { useMutation } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions } from '../shared/query-options';

interface TriggerScoreArgs {
  scorerName: string;
  traceId: string;
  spanId?: string;
}

type TriggerScorerResponse = Awaited<ReturnType<MastraClient['score']>>;

export const useTriggerScorer = ({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<TriggerScorerResponse, TriggerScoreArgs> } = {}) => {
  const client = useMastraClient();

  return useMutation({
    mutationFn: async ({ scorerName, traceId, spanId }: TriggerScoreArgs) => {
      const response = await client.score({
        scorerName,
        targets: [{ traceId, spanId }],
      });

      return response;
    },
    ...queryOptions,
  });
};
