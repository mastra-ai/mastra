import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const FEEDBACK_PER_PAGE = 20;

type FeedbackReviewStatus = 'needs-review' | 'reviewed';

export function useFeedback({ page, reviewStatus }: { page: number; reviewStatus?: FeedbackReviewStatus }) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['feedback', page, reviewStatus ?? 'all'],
    queryFn: () =>
      client.listFeedback({
        filters: reviewStatus ? { reviewStatus } : undefined,
        pagination: { page, perPage: FEEDBACK_PER_PAGE },
        orderBy: { field: 'timestamp', direction: 'DESC' },
      }),
  });
}

export function useFeedbackInboxCount({ enabled }: { enabled: boolean }) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['feedback', 'inbox-count'],
    queryFn: () =>
      client.listFeedback({
        filters: { reviewStatus: 'needs-review' },
        pagination: { page: 0, perPage: 1 },
        orderBy: { field: 'timestamp', direction: 'DESC' },
      }),
    enabled,
    refetchInterval: 3000,
  });
}

export function useUpdateFeedbackReviewStatus() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ feedbackId, reviewStatus }: { feedbackId: string; reviewStatus: FeedbackReviewStatus }) =>
      client.updateFeedbackReviewStatus({ feedbackId, reviewStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feedback'] }),
  });
}
