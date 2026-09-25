import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { getFeedbackRefetchInterval } from '@/domains/feedback/utils/feedback-refetch-interval';

type UseTraceFeedbackProps = {
  traceId?: string;
  page?: number;
  enabled?: boolean;
};

/** Loads a page of trace-level feedback and stops polling when storage cannot serve feedback. */
export const useTraceFeedback = ({ traceId = '', page, enabled = true }: UseTraceFeedbackProps) => {
  const client = useMastraClient();
  const pageNumber = page ?? 0;
  return useQuery({
    queryKey: ['trace-feedback', traceId, pageNumber],
    queryFn: () =>
      client.listFeedback({
        filters: { traceId },
        pagination: { page: pageNumber, perPage: 10 },
      }),
    enabled: enabled && !!traceId,
    // The API can't express "spanId is null", so trace-level records are isolated client-side.
    // Note: this runs after server-side pagination, so a page may hold fewer than `perPage` rows.
    select: data => {
      const feedback = data.feedback.filter(item => !item.spanId);
      if (!data.pagination) return { ...data, feedback };
      return { ...data, feedback, pagination: { ...data.pagination, total: feedback.length } };
    },
    refetchInterval: getFeedbackRefetchInterval,
    gcTime: 0,
    staleTime: 0,
  });
};
