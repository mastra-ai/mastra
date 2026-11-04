import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import { getFeedbackRefetchInterval } from '../feedback/feedback-refetch-interval';
import type { MastraQueryOptions } from '../shared/query-options';

type TraceFeedbackResponse = Awaited<ReturnType<MastraClient['listFeedback']>>;

type UseTraceFeedbackProps<TData> = {
  traceId?: string;
  page?: number;
  queryOptions?: MastraQueryOptions<TraceFeedbackResponse, TData>;
};

/** Loads a page of trace-level feedback and stops polling when storage cannot serve feedback. */
/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useTraceFeedback = <TData = TraceFeedbackResponse,>({
  traceId = '',
  page,
  queryOptions,
}: UseTraceFeedbackProps<TData>): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  const pageNumber = page ?? 0;
  return useQuery({
    queryKey: ['trace-feedback', traceId, pageNumber],
    queryFn: () =>
      client.listFeedback({
        filters: { traceId },
        pagination: { page: pageNumber, perPage: 10 },
      }),
    // The API can't express "spanId is null", so trace-level records are isolated client-side.
    // Note: this runs after server-side pagination, so a page may hold fewer than `perPage` rows.
    select: data => {
      const feedback = data.feedback.filter(item => !item.spanId);
      if (!data.pagination) return { ...data, feedback } as TData;
      return { ...data, feedback, pagination: { ...data.pagination, total: feedback.length } } as TData;
    },
    refetchInterval: getFeedbackRefetchInterval,
    gcTime: 0,
    staleTime: 0,
    ...queryOptions,
  });
};
