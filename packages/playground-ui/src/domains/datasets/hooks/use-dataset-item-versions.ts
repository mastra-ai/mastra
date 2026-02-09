import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

export interface DatasetItemVersion {
  id: string;
  itemId: string;
  datasetId: string;
  versionNumber: number;
  /** Alias for datasetVersion for backward compatibility */
  version: Date | string;
  datasetVersion: Date | string;
  snapshot: {
    input: unknown;
    expectedOutput?: unknown;
    context?: Record<string, unknown>;
  };
  isDeleted: boolean;
  createdAt: Date | string;
  isLatest: boolean;
}

const PER_PAGE = 5;

/**
 * Hook to fetch dataset item versions from the API with infinite pagination.
 */
export const useDatasetItemVersions = (datasetId: string, itemId: string) => {
  const client = useMastraClient();

  return useInfiniteQuery({
    queryKey: ['dataset-item-versions', datasetId, itemId],
    queryFn: async ({ pageParam }) => {
      return client.listDatasetItemVersions(datasetId, itemId, { page: pageParam, perPage: PER_PAGE });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (lastPage?.pagination?.hasMore) {
        return lastPageParam + 1;
      }
      return undefined;
    },
    select: data => {
      return data.pages.flatMap(page => page?.versions ?? []).map((v, index) => ({
        id: v.id,
        itemId: v.itemId,
        datasetId: v.datasetId,
        versionNumber: v.versionNumber,
        version: v.datasetVersion, // Alias for backward compatibility
        datasetVersion: v.datasetVersion,
        snapshot: v.snapshot,
        isDeleted: v.isDeleted,
        createdAt: v.createdAt,
        isLatest: index === 0,
      }));
    },
    enabled: Boolean(datasetId) && Boolean(itemId),
  });
};

/**
 * Hook to fetch a specific version of a dataset item.
 */
export const useDatasetItemVersion = (datasetId: string, itemId: string, versionNumber: number) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['dataset-item-version', datasetId, itemId, versionNumber],
    queryFn: async (): Promise<DatasetItemVersion> => {
      const v = await client.getDatasetItemVersion(datasetId, itemId, versionNumber);
      return {
        id: v.id,
        itemId: v.itemId,
        datasetId: v.datasetId,
        versionNumber: v.versionNumber,
        version: v.datasetVersion, // Alias for backward compatibility
        datasetVersion: v.datasetVersion,
        snapshot: v.snapshot,
        isDeleted: v.isDeleted,
        createdAt: v.createdAt,
        isLatest: false, // Not first in list, so not latest by default
      };
    },
    enabled: Boolean(datasetId) && Boolean(itemId) && versionNumber > 0,
  });
};
