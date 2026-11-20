import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import { getFeedbackRefetchInterval } from '../feedback/feedback-refetch-interval';
import { mergePendingFeedback, settlePendingFeedback, usePendingFeedback } from '../feedback/optimistic-feedback';
import type { FeedbackListResponse } from '../feedback/optimistic-feedback';
import {
  applyPendingFeedbackDeletions,
  hasDeletingFeedback,
  settlePendingFeedbackDeletions,
  usePendingFeedbackDeletions,
} from '../feedback/pending-feedback-deletions';
import type { MastraQueryOptions } from '../shared/query-options';

type TraceFeedbackResponse = Awaited<ReturnType<MastraClient['listFeedback']>>;

type UseTraceFeedbackProps<TData> = {
  traceId?: string;
  page?: number;
  queryOptions?: MastraQueryOptions<TraceFeedbackResponse, TData>;
};

/**
 * Loads a page of trace-level feedback and stops polling when storage cannot serve feedback.
 * The first page also shows comments submitted through `useCreateFeedback` that the server
 * does not return yet (feedback writes are eventually consistent on Mastra Platform).
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useTraceFeedback = <TData = FeedbackListResponse,>({
  traceId = '',
  page,
  queryOptions,
}: UseTraceFeedbackProps<TData>): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const pageNumber = page ?? 0;
  const deletions = usePendingFeedbackDeletions({ traceId });
  const pending = usePendingFeedback({ traceId, enabled: pageNumber === 0 });
  const { select: callerSelect, ...restQueryOptions } = queryOptions ?? {};
  // The API can't express "spanId is null", so trace-level records are isolated client-side.
  // Note: this runs after server-side pagination, so a page may hold fewer than `perPage` rows.
  // The caller's selector runs last, so it still sees pending comments and only trace-level rows.
  const select = useCallback(
    (data: TraceFeedbackResponse) => {
      const merged = applyPendingFeedbackDeletions(mergePendingFeedback(data, pending), deletions);
      const feedback = merged.feedback.filter(item => !item.spanId);
      const traceLevel: FeedbackListResponse = merged.pagination
        ? { ...merged, feedback, pagination: { ...merged.pagination, total: feedback.length } }
        : { ...merged, feedback };
      return callerSelect ? callerSelect(traceLevel) : (traceLevel as TData);
    },
    [pending, deletions, callerSelect],
  );
  return useQuery({
    queryKey: ['trace-feedback', traceId, pageNumber],
    queryFn: async ({ signal }) => {
      const data = await client.listFeedback({
        filters: { traceId },
        pagination: { page: pageNumber, perPage: 10 },
      });
      // A cancelled or superseded fetch must not settle pending comments its result never displays.
      if (pageNumber === 0 && !signal.aborted) settlePendingFeedback(queryClient, { traceId }, data);
      if (!signal.aborted) settlePendingFeedbackDeletions(queryClient, { traceId, page: pageNumber }, data);
      return data;
    },
    select,
    refetchInterval: query => getFeedbackRefetchInterval(query, pending.length > 0 || hasDeletingFeedback(deletions)),
    gcTime: 0,
    staleTime: 0,
    ...restQueryOptions,
  });
};
