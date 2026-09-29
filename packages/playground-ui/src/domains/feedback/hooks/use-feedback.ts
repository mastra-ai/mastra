import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export type FeedbackReviewStatus = 'needs-review' | 'reviewed';

export function useUpdateFeedbackReviewStatus() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ feedbackId, reviewStatus }: { feedbackId: string; reviewStatus: FeedbackReviewStatus }) =>
      client.updateFeedbackReviewStatus({ feedbackId, reviewStatus }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['trace-feedback'] }),
        queryClient.invalidateQueries({ queryKey: ['span-feedback'] }),
      ]),
  });
}
