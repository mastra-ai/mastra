import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { getTraceFeedbackRefetchInterval } from './use-trace-feedback';

type UseSpanFeedbackProps = {
  traceId?: string;
  spanId?: string;
  page?: number;
};

/**
 * Feedback scoped to a single span. Both identifiers are required: without a `spanId`
 * the query stays disabled rather than falling back to trace-wide feedback.
 */
export const useSpanFeedback = ({ traceId = '', spanId = '', page }: UseSpanFeedbackProps) => {
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
    enabled: !!traceId && !!spanId,
    refetchInterval: getTraceFeedbackRefetchInterval,
    gcTime: 0,
    staleTime: 0,
  });
};
