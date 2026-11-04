import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type ReviewSummaryResponse = Awaited<ReturnType<MastraClient['getExperimentReviewSummary']>>;

export function useReviewSummary<TData = ReviewSummaryResponse>({
  queryOptions,
}: {
  queryOptions?: MastraQueryOptions<ReviewSummaryResponse, TData>;
} = {}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['experiment-review-summary'],
    queryFn: () => client.getExperimentReviewSummary(),
    ...queryOptions,
  });
}
