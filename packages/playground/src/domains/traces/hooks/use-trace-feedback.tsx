import {
  isObservabilityUnavailableError,
  isUnsupportedObservabilityOperationError,
} from '@mastra/playground-ui/utils/query-utils';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

const TRACE_FEEDBACK_REFETCH_INTERVAL_MS = 3000;

export function getTraceFeedbackRefetchInterval(query: { state: { error: unknown } }) {
  if (
    isUnsupportedObservabilityOperationError(query.state.error, 'feedback') ||
    isObservabilityUnavailableError(query.state.error)
  ) {
    return false;
  }
  return TRACE_FEEDBACK_REFETCH_INTERVAL_MS;
}

type UseTraceFeedbackProps = {
  traceId?: string;
  page?: number;
};

export const useTraceFeedback = ({ traceId = '', page }: UseTraceFeedbackProps) => {
  const client = useMastraClient();
  const pageNumber = page ?? 0;
  return useQuery({
    queryKey: ['trace-feedback', traceId, pageNumber],
    queryFn: () =>
      client.listFeedback({
        filters: { traceId },
        pagination: { page: pageNumber, perPage: 10 },
      }),
    enabled: !!traceId,
    // The API can't express "spanId is null", so trace-level records are isolated client-side.
    // Note: this runs after server-side pagination, so a page may hold fewer than `perPage` rows.
    select: data => {
      const feedback = data.feedback.filter(item => !item.spanId);
      if (!data.pagination) return { ...data, feedback };
      return { ...data, feedback, pagination: { ...data.pagination, total: feedback.length } };
    },
    refetchInterval: getTraceFeedbackRefetchInterval,
    gcTime: 0,
    staleTime: 0,
  });
};
