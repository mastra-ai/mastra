import { useQuery } from '@tanstack/react-query';
import { useDataset } from './use-datasets';

export interface DatasetVersion {
  version: Date | string;
  isCurrent: boolean;
}

/**
 * Hook to fetch dataset versions.
 * Currently mocks the behavior by generating 3-9 versions based on the current dataset version.
 */
export const useDatasetVersions = (datasetId: string) => {
  const { data: dataset } = useDataset(datasetId);

  return useQuery({
    queryKey: ['dataset-versions', datasetId, dataset?.version],
    queryFn: (): DatasetVersion[] => {
      // Get current version timestamp or use current time
      const currentVersionDate = dataset?.version
        ? typeof dataset.version === 'string'
          ? new Date(dataset.version)
          : dataset.version
        : new Date();

      // Generate 3-9 mock versions based on the timestamp
      const versionCount = 3 + (currentVersionDate.getTime() % 7);

      const versions: DatasetVersion[] = [];

      for (let i = 0; i < versionCount; i++) {
        // Each previous version is ~1-7 days before the next
        const daysBack = i * (1 + (currentVersionDate.getDate() % 7));
        const versionDate = new Date(currentVersionDate);
        versionDate.setDate(versionDate.getDate() - daysBack);
        versionDate.setHours(versionDate.getHours() - i * 2);

        versions.push({
          version: versionDate,
          isCurrent: i === 0,
        });
      }

      return versions;
    },
    enabled: Boolean(datasetId),
  });
};
