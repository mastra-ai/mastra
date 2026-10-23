import type { DatasetItemVersionResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export type DatasetItemVersion = DatasetItemVersionResponse & {
  validTo: number | null;
  isDeleted: boolean;
  isLatest: boolean;
};

/**
 * Hook to fetch full item history (SCD-2 rows).
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useDatasetItemVersions = <TData = DatasetItemVersion[]>({
  datasetId,
  itemId,
  queryOptions,
}: {
  datasetId: string;
  itemId: string;
  queryOptions?: MastraQueryOptions<DatasetItemVersion[], TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['dataset-item-versions', datasetId, itemId],
    queryFn: async (): Promise<DatasetItemVersion[]> => {
      const res = await client.getItemHistory(datasetId, itemId);

      return (res?.history ?? []).map(
        (version, index): DatasetItemVersion => ({
          id: version.id,
          datasetId: version.datasetId,
          datasetVersion: version.datasetVersion,
          input: version.input,
          groundTruth: version.groundTruth,
          expectedTrajectory: version.expectedTrajectory,
          toolMocks: version.toolMocks ?? undefined,
          scorerIds: version.scorerIds ?? undefined,
          requestContext: version.requestContext ?? undefined,
          metadata: version.metadata ?? undefined,
          validTo: version.validTo,
          isDeleted: version.isDeleted,
          createdAt: version.createdAt,
          updatedAt: version.updatedAt,
          isLatest: index === 0,
        }),
      );
    },
    ...queryOptions,
  });
};

/**
 * Hook to fetch a specific version of a dataset item.
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useDatasetItemVersion = <TData = DatasetItemVersion>({
  datasetId,
  itemId,
  datasetVersion,
  latestVersion,
  queryOptions,
}: {
  datasetId: string;
  itemId: string;
  datasetVersion: number;
  latestVersion?: number;
  queryOptions?: MastraQueryOptions<DatasetItemVersion, TData>;
}): UseQueryResult<TData, Error> => {
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
        expectedTrajectory: v.expectedTrajectory,
        toolMocks: v.toolMocks ?? undefined,
        scorerIds: v.scorerIds ?? undefined,
        requestContext: v.requestContext ?? undefined,
        metadata: v.metadata ?? undefined,
        validTo: null,
        isDeleted: false,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
        isLatest: latestVersion != null ? datasetVersion === latestVersion : false,
      };
    },
    ...queryOptions,
  });
};
