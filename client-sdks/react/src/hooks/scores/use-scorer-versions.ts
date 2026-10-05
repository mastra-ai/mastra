import type { UseQueryResult } from '@tanstack/react-query';
import type {
  ListScorerVersionsParams,
  CreateScorerVersionParams,
  ListScorerVersionsResponse,
  ScorerVersionResponse,
  CompareScorerVersionsResponse,
  ActivateScorerVersionResponse,
  DeleteScorerVersionResponse,
} from '@mastra/client-js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';

export type { ListScorerVersionsParams, CreateScorerVersionParams };

/**
 * Hook to list versions of a stored scorer
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useScorerVersions = <TData = ListScorerVersionsResponse>({
  scorerId,
  params,
  requestContext,
  queryOptions,
}: {
  scorerId: string;
  params?: ListScorerVersionsParams;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<ListScorerVersionsResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<ListScorerVersionsResponse, Error, TData>({
    queryKey: ['scorer-versions', scorerId, params, requestContext],
    queryFn: () => client.getStoredScorer(scorerId).listVersions(params, requestContext),
    ...queryOptions,
  });
};

/**
 * Hook to get a single version of a stored scorer
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useScorerVersion = <TData = ScorerVersionResponse>({
  scorerId,
  versionId,
  requestContext,
  queryOptions,
}: {
  scorerId: string;
  versionId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<ScorerVersionResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<ScorerVersionResponse, Error, TData>({
    queryKey: ['scorer-version', scorerId, versionId, requestContext],
    queryFn: () => client.getStoredScorer(scorerId).getVersion(versionId, requestContext),
    ...queryOptions,
  });
};

/**
 * Hook to create a new version of a stored scorer
 */
export const useCreateScorerVersion = ({
  scorerId,
  requestContext,
  queryOptions,
}: {
  scorerId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<ScorerVersionResponse, CreateScorerVersionParams | undefined>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ScorerVersionResponse, Error, CreateScorerVersionParams | undefined>({
    mutationFn: (params?: CreateScorerVersionParams) =>
      client.getStoredScorer(scorerId).createVersion(params, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
      void queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
    },
    ...queryOptions,
  });
};

/**
 * Hook to activate a specific version of a stored scorer
 */
export const useActivateScorerVersion = ({
  scorerId,
  requestContext,
  queryOptions,
}: {
  scorerId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<ActivateScorerVersionResponse, string>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ActivateScorerVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredScorer(scorerId).activateVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
      void queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
    },
    ...queryOptions,
  });
};

/**
 * Hook to restore a specific version of a stored scorer (creates a new version from an old one)
 */
export const useRestoreScorerVersion = ({
  scorerId,
  requestContext,
  queryOptions,
}: {
  scorerId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<ScorerVersionResponse, string>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ScorerVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredScorer(scorerId).restoreVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
      void queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
    },
    ...queryOptions,
  });
};

/**
 * Hook to delete a specific version of a stored scorer
 */
export const useDeleteScorerVersion = ({
  scorerId,
  requestContext,
  queryOptions,
}: {
  scorerId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<DeleteScorerVersionResponse, string>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<DeleteScorerVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredScorer(scorerId).deleteVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
    },
    ...queryOptions,
  });
};

/**
 * Hook to compare two versions of a stored scorer
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useCompareScorerVersions = <TData = CompareScorerVersionsResponse>({
  scorerId,
  fromVersionId,
  toVersionId,
  requestContext,
  queryOptions,
}: {
  scorerId: string;
  fromVersionId: string;
  toVersionId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<CompareScorerVersionsResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<CompareScorerVersionsResponse, Error, TData>({
    queryKey: ['scorer-versions-compare', scorerId, fromVersionId, toVersionId, requestContext],
    queryFn: () => client.getStoredScorer(scorerId).compareVersions(fromVersionId, toVersionId, requestContext),
    ...queryOptions,
  });
};
