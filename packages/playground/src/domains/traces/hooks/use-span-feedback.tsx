import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { getFeedbackRefetchInterval } from '@/domains/feedback/utils/feedback-refetch-interval';

type UseSpanFeedbackProps = {
  traceId?: string;
  spanId?: string;
  page?: number;
  enabled?: boolean;
};

/**
 * Feedback scoped to a single span. Both identifiers are required: without a `spanId`
 * the query stays disabled rather than falling back to trace-wide feedback.
 */
export const useSpanFeedback = ({ traceId = '', spanId = '', page, enabled = true }: UseSpanFeedbackProps) => {
  const client = useMastraClient();
  const pageNumber = page ?? 0;
  return useQuery({
    // `spanId` must stay in the key, otherwise React Query serves the previously
    // selected span's feedback when switching spans within the same trace.
    queryKey: ['span-feedback', traceId, spanId, pageNumber],
    queryFn: () =>
      client.listFeedback({
        filters: { traceId, spanId },
        pagination: { page: pageNumber, perPage: 10 },
      }),
    enabled: enabled && !!traceId && !!spanId,
    refetchInterval: getFeedbackRefetchInterval,
    gcTime: 0,
    staleTime: 0,
  });
};
