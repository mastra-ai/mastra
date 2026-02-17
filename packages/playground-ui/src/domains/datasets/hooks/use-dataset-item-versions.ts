import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export interface DatasetItemVersion {
  id: string;
  datasetId: string;
  datasetVersion: number;
  input: unknown;
  groundTruth?: unknown;
  metadata?: Record<string, unknown>;
  validTo: number | null;
  isDeleted: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  isLatest: boolean;
}

/**
 * Hook to fetch full item history (SCD-2 rows).
 */
export const useDatasetItemVersions = (datasetId: string, itemId: string) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['dataset-item-versions', datasetId, itemId],
    queryFn: async () => {
      const res = await client.getItemHistory(datasetId, itemId);
      return (res?.history ?? []).map((v, index) => ({
        id: v.id,
        datasetId: v.datasetId,
        datasetVersion: v.datasetVersion,
        input: v.input,
        groundTruth: v.groundTruth,
        metadata: v.metadata,
        validTo: v.validTo,
        isDeleted: v.isDeleted,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
        isLatest: index === 0,
      })) as DatasetItemVersion[];
    },
    enabled: Boolean(datasetId) && Boolean(itemId),
  });
};

/**
 * Hook to fetch a specific version of a dataset item.
 */
export const useDatasetItemVersion = (datasetId: string, itemId: string, datasetVersion: number) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['dataset-item-version', datasetId, itemId, datasetVersion],
    queryFn: async (): Promise<DatasetItemVersion> => {
      const v = await client.getDatasetItemVersion(datasetId, itemId, datasetVersion);
      return {
        id: v.id,
        datasetId: v.datasetId,
        datasetVersion: v.datasetVersion,
        input: v.input,
        groundTruth: v.groundTruth,
        metadata: v.metadata,
        validTo: v.validTo,
        isDeleted: v.isDeleted,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
        isLatest: false,
      };
    },
    enabled: Boolean(datasetId) && Boolean(itemId) && datasetVersion > 0,
  });
};
