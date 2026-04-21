import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export function useReviewSummary() {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['experiment-review-summary'],
    queryFn: () => client.getExperimentReviewSummary(),
  });
}
