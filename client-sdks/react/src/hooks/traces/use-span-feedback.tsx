import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';

import { useMastraClient } from '../../mastra-client-context';
import { getFeedbackRefetchInterval } from '../feedback/feedback-refetch-interval';
import type { MastraQueryOptions } from '../shared/query-options';

type SpanFeedbackResponse = Awaited<ReturnType<MastraClient['listFeedback']>>;

type UseSpanFeedbackProps<TData> = {
  traceId?: string;
  spanId?: string;
  page?: number;
  queryOptions?: MastraQueryOptions<SpanFeedbackResponse, TData>;
};

/**
 * Feedback scoped to a single span. Both identifiers are required: without a `spanId`
 * the query stays disabled rather than falling back to trace-wide feedback.
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useSpanFeedback = <TData = SpanFeedbackResponse,>({
  traceId = '',
  spanId = '',
  page,
  queryOptions,
}: UseSpanFeedbackProps<TData>): UseQueryResult<TData, Error> => {
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
    refetchInterval: getFeedbackRefetchInterval,
    gcTime: 0,
    staleTime: 0,
    ...queryOptions,
  });
};
