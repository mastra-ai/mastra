import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/** Trace IDs that carry at least one human review, from the most recent feedback page. */
export function useReviewedTraceIds() {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['reviewed-trace-ids'],
    queryFn: async () => {
      const response = await client.listFeedback({ pagination: { page: 0, perPage: 100 } });
      const reviewed = new Set<string>();
      for (const feedback of response.feedback) {
        if (feedback.feedbackType === 'review' && feedback.traceId) reviewed.add(feedback.traceId);
      }
      return reviewed;
    },
    refetchInterval: 5000,
  });
}
