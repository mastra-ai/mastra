import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery } from '@tanstack/react-query';

export interface DatasetVersion {
  id?: string;
  datasetId?: string;
  version: number;
  createdAt?: Date | string;
  isCurrent: boolean;
}

const PER_PAGE = 10;

/**
 * Hook to fetch dataset versions from the API with infinite pagination.
 */
export const useDatasetVersions = (datasetId: string) => {
  const client = useMastraClient();

  return useInfiniteQuery({
    queryKey: ['dataset-versions', datasetId],
    queryFn: async ({ pageParam }) => {
      return client.listDatasetVersions(datasetId, { page: pageParam, perPage: PER_PAGE });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (lastPage?.pagination?.hasMore) {
        return lastPageParam + 1;
      }
      return undefined;
    },
    select: data => {
      return data.pages
        .flatMap(page => page?.versions ?? [])
        .map((v, index) => ({
          id: v.id,
          datasetId: v.datasetId,
          version: v.version,
          createdAt: v.createdAt,
          isCurrent: index === 0,
        }));
    },
    enabled: Boolean(datasetId),
  });
};
