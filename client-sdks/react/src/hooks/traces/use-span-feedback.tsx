import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useMastraClient } from '../../mastra-client-context';
import { getFeedbackRefetchInterval } from '../feedback/feedback-refetch-interval';
import { mergePendingFeedback, settlePendingFeedback, usePendingFeedback } from '../feedback/optimistic-feedback';
import type { FeedbackListResponse } from '../feedback/optimistic-feedback';
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
 * The first page also shows comments submitted through `useCreateFeedback` that the server
 * does not return yet (feedback writes are eventually consistent on Mastra Platform).
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useSpanFeedback = <TData = FeedbackListResponse,>({
  traceId = '',
  spanId = '',
  page,
  queryOptions,
}: UseSpanFeedbackProps<TData>): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const pageNumber = page ?? 0;
  const pending = usePendingFeedback({ traceId, spanId, enabled: pageNumber === 0 });
  const { select: callerSelect, ...restQueryOptions } = queryOptions ?? {};
  // The caller's selector runs on the merged data, so it still sees pending comments.
  const select = useCallback(
    (data: SpanFeedbackResponse) => {
      const merged = mergePendingFeedback(data, pending);
      return callerSelect ? callerSelect(merged) : (merged as TData);
    },
    [pending, callerSelect],
  );
  return useQuery({
    // `spanId` must stay in the key, otherwise React Query serves the previously
    // selected span's feedback when switching spans within the same trace.
    queryKey: ['span-feedback', traceId, spanId, pageNumber],
    queryFn: async () => {
      const data = await client.listFeedback({
        filters: { traceId, spanId },
        pagination: { page: pageNumber, perPage: 10 },
      });
      if (pageNumber === 0) settlePendingFeedback(queryClient, { traceId, spanId }, data);
      return data;
    },
    select,
    refetchInterval: query => getFeedbackRefetchInterval(query, pending.length > 0),
    gcTime: 0,
    staleTime: 0,
    ...restQueryOptions,
  });
};
