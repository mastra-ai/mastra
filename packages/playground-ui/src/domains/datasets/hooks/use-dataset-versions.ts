import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export interface DatasetVersion {
  id?: string;
  datasetId?: string;
  version: Date | string;
  createdAt?: Date | string;
  isCurrent: boolean;
}

/**
 * Hook to fetch dataset versions from the API.
 */
export const useDatasetVersions = (datasetId: string, pagination?: { page?: number; perPage?: number }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['dataset-versions', datasetId, pagination],
    queryFn: async (): Promise<DatasetVersion[]> => {
      const response = await client.listDatasetVersions(datasetId, pagination);
      // Transform API response to include isCurrent flag (first version is current)
      const versions = response?.versions ?? [];
      return versions.map((v, index) => ({
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
