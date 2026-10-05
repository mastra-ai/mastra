import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import { isObservabilityUnavailableError, isUnsupportedObservabilityOperationError } from '../query-utils';

const TRACE_SPAN_SCORES_REFETCH_INTERVAL_MS = 15_000;

export function getTraceSpanScoresRefetchInterval(query: { state: { error: unknown } }) {
  if (
    isUnsupportedObservabilityOperationError(query.state.error, 'scores') ||
    isObservabilityUnavailableError(query.state.error)
  ) {
    return false;
  }
  return TRACE_SPAN_SCORES_REFETCH_INTERVAL_MS;
}

type useTraceSpanScoresProps = {
  traceId?: string;
  spanId?: string;
  page?: number;
};

export const useTraceSpanScores = ({ traceId = '', spanId = '', page }: useTraceSpanScoresProps) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['trace-span-scores', traceId, spanId, page],
    queryFn: () => client.listScoresBySpan({ traceId, spanId, page: page || 0, perPage: 10 }),
    enabled: !!traceId && !!spanId,
    refetchInterval: getTraceSpanScoresRefetchInterval,
    gcTime: 0,
    staleTime: 0,
  });
};
