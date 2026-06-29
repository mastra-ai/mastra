import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

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
    refetchInterval: 3000,
    gcTime: 0,
    staleTime: 0,
  });
};
