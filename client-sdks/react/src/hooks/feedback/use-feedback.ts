import type { MastraClient } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions } from '../shared/query-options';

export type FeedbackReviewStatus = 'needs-review' | 'reviewed';

type UpdateFeedbackReviewStatusVariables = { feedbackId: string; reviewStatus: FeedbackReviewStatus };
type UpdateFeedbackReviewStatusResponse = Awaited<ReturnType<MastraClient['updateFeedbackReviewStatus']>>;

export function useUpdateFeedbackReviewStatus({
  queryOptions,
}: {
  queryOptions?: MastraMutationOptions<UpdateFeedbackReviewStatusResponse, UpdateFeedbackReviewStatusVariables>;
} = {}) {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ feedbackId, reviewStatus }: UpdateFeedbackReviewStatusVariables) =>
      client.updateFeedbackReviewStatus({ feedbackId, reviewStatus }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['trace-feedback'] }),
        queryClient.invalidateQueries({ queryKey: ['span-feedback'] }),
      ]),
    ...queryOptions,
  });
}
