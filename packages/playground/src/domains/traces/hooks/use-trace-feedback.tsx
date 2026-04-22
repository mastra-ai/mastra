import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

type UseTraceFeedbackProps = {
  traceId?: string;
  page?: number;
};

export const useTraceFeedback = ({ traceId = '', page }: UseTraceFeedbackProps) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['trace-feedback', traceId, page],
    queryFn: () =>
      client.listFeedback({
        filters: { traceId },
        pagination: { page: page || 0, perPage: 10 },
      }),
    enabled: !!traceId,
    refetchInterval: 3000,
    gcTime: 0,
    staleTime: 0,
  });
};
