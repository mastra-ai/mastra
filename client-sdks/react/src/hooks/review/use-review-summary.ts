import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

export function useReviewSummary() {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['experiment-review-summary'],
    queryFn: () => client.getExperimentReviewSummary(),
  });
}
