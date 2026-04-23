import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

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
    refetchInterval: 3000,
    gcTime: 0,
    staleTime: 0,
  });
};
