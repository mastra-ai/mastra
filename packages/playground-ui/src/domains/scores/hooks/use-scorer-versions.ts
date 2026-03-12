import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import type {
  ListScorerVersionsParams,
  CreateScorerVersionParams,
  ListScorerVersionsResponse,
  ScorerVersionResponse,
  CompareScorerVersionsResponse,
  ActivateScorerVersionResponse,
  DeleteScorerVersionResponse,
} from '@mastra/client-js';

export type { ListScorerVersionsParams, CreateScorerVersionParams };

/**
 * Hook to list versions of a stored scorer
 */
export const useScorerVersions = ({ scorerId, params }: { scorerId: string; params?: ListScorerVersionsParams }) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery<ListScorerVersionsResponse>({
    queryKey: ['scorer-versions', scorerId, params, requestContext],
    queryFn: () => client.getStoredScorer(scorerId).listVersions(params, requestContext),
    enabled: !!scorerId,
  });
};

/**
 * Hook to get a single version of a stored scorer
 */
export const useScorerVersion = ({ scorerId, versionId }: { scorerId: string; versionId: string }) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery<ScorerVersionResponse>({
    queryKey: ['scorer-version', scorerId, versionId, requestContext],
    queryFn: () => client.getStoredScorer(scorerId).getVersion(versionId, requestContext),
    enabled: !!scorerId && !!versionId,
  });
};

/**
 * Hook to create a new version of a stored scorer
 */
export const useCreateScorerVersion = ({ scorerId }: { scorerId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<ScorerVersionResponse, Error, CreateScorerVersionParams | undefined>({
    mutationFn: (params?: CreateScorerVersionParams) =>
      client.getStoredScorer(scorerId).createVersion(params, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
      queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
    },
  });
};

/**
 * Hook to activate a specific version of a stored scorer
 */
export const useActivateScorerVersion = ({ scorerId }: { scorerId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<ActivateScorerVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredScorer(scorerId).activateVersion(versionId, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
      queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
    },
  });
};

/**
 * Hook to restore a specific version of a stored scorer (creates a new version from an old one)
 */
export const useRestoreScorerVersion = ({ scorerId }: { scorerId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<ScorerVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredScorer(scorerId).restoreVersion(versionId, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
      queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
    },
  });
};

/**
 * Hook to delete a specific version of a stored scorer
 */
export const useDeleteScorerVersion = ({ scorerId }: { scorerId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<DeleteScorerVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredScorer(scorerId).deleteVersion(versionId, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
    },
  });
};

/**
 * Hook to compare two versions of a stored scorer
 */
export const useCompareScorerVersions = ({
  scorerId,
  fromVersionId,
  toVersionId,
}: {
  scorerId: string;
  fromVersionId: string;
  toVersionId: string;
}) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery<CompareScorerVersionsResponse>({
    queryKey: ['scorer-versions-compare', scorerId, fromVersionId, toVersionId, requestContext],
    queryFn: () => client.getStoredScorer(scorerId).compareVersions(fromVersionId, toVersionId, requestContext),
    enabled: !!scorerId && !!fromVersionId && !!toVersionId,
  });
};
