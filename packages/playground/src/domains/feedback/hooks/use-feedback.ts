import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const FEEDBACK_PER_PAGE = 20;

export type FeedbackReviewStatus = 'needs-review' | 'reviewed';

export function useFeedback({ reviewStatus }: { reviewStatus?: FeedbackReviewStatus }) {
  const client = useMastraClient();

  const query = useInfiniteQuery({
    queryKey: ['feedback', 'list', reviewStatus ?? 'all'],
    queryFn: ({ pageParam }) =>
      client.listFeedback({
        filters: reviewStatus ? { reviewStatus } : undefined,
        pagination: { page: pageParam, perPage: FEEDBACK_PER_PAGE },
        orderBy: { field: 'timestamp', direction: 'DESC' },
      }),
    initialPageParam: 0,
    getNextPageParam: lastPage => (lastPage.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined),
  });

  return {
    ...query,
    items: query.data?.pages.flatMap(page => page.feedback) ?? [],
    total: query.data?.pages[0]?.pagination?.total,
  };
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
