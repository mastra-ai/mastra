import { useMastraClient } from '@mastra/react';
import { datasetItemsQueryOptions, datasetQueryOptions } from '@mastra/react/hooks/datasets';
import { useQueryClient } from '@tanstack/react-query';

const PREFETCH_STALE_MS = 30_000;

/**
 * Warms what picking a dataset needs (its default scorers and item count) while it's highlighted in
 * the list, so the field and Scorers don't pop in after the click.
 */
export function usePrefetchDataset() {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return (datasetId: string | undefined) => {
    if (!datasetId) return;
    // Highlighting fires on every arrow key and keystroke: reuse a recent prefetch, and fail quietly
    // like the hooks do instead of retrying.
    void queryClient.prefetchQuery({
      ...datasetQueryOptions(client, datasetId),
      staleTime: PREFETCH_STALE_MS,
      retry: false,
    });
    void queryClient.prefetchInfiniteQuery({
      ...datasetItemsQueryOptions(client, { datasetId }),
      staleTime: PREFETCH_STALE_MS,
      retry: false,
    });
  };
}
