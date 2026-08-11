import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchTraceInsight } from '../entity-learning-api';

export function useTraceInsight(traceId: string | undefined) {
  return useQuery({
    // A source traceId is globally unique and the endpoint is not
    // entity-scoped, so the key intentionally omits entityType/entityId.
    queryKey: ['entity-learning', 'trace-insight', traceId],
    queryFn: traceId === undefined ? skipToken : () => fetchTraceInsight(traceId),
    staleTime: 30_000,
  });
}
