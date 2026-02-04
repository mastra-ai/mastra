import { useQuery } from '@tanstack/react-query';
import { useDatasetItem } from './use-dataset-items';

export interface DatasetItemVersion {
  version: Date | string;
  isLatest: boolean;
}

/**
 * Hook to fetch dataset item versions.
 * Currently mocks the behavior by generating 3-9 versions based on the current item version.
 */
export const useDatasetItemVersions = (datasetId: string, itemId: string) => {
  const { data: item } = useDatasetItem(datasetId, itemId);

  return useQuery({
    queryKey: ['dataset-item-versions', datasetId, itemId, item?.version],
    queryFn: (): DatasetItemVersion[] => {
      // Get current version timestamp or use current time
      const currentVersionDate = item?.version
        ? typeof item.version === 'string'
          ? new Date(item.version)
          : item.version
        : new Date();

      // Generate 3+ mock versions based on the timestamp
      const versionCount = 3 + (currentVersionDate.getTime() % 15);

      const versions: DatasetItemVersion[] = [];

      for (let i = 0; i < versionCount; i++) {
        // Each previous version is ~1-7 days before the next
        const daysBack = i * (1 + (currentVersionDate.getDate() % 7));
        const versionDate = new Date(currentVersionDate);
        versionDate.setDate(versionDate.getDate() - daysBack);
        versionDate.setHours(versionDate.getHours() - i * 2);

        versions.push({
          version: versionDate,
          isLatest: i === 0,
        });
      }

      return versions;
    },
    enabled: Boolean(datasetId) && Boolean(itemId),
  });
};
