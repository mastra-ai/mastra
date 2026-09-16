import type {
  ListScorerVersionsParams,
  CreateScorerVersionParams,
  ListScorerVersionsResponse,
  ScorerVersionResponse,
  CompareScorerVersionsResponse,
  ActivateScorerVersionResponse,
  DeleteScorerVersionResponse,
} from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type { ListScorerVersionsParams, CreateScorerVersionParams };

/**
 * Hook to list versions of a stored scorer
 */
export const useScorerVersions = ({ scorerId, params }: { scorerId: string; params?: ListScorerVersionsParams }) => {
  const client = useMastraClient();

  return useQuery<ListScorerVersionsResponse>({
    queryKey: ['scorer-versions', scorerId, params],
    queryFn: () => client.getStoredScorer(scorerId).listVersions(params),
    enabled: !!scorerId,
  });
};

/**
 * Hook to get a single version of a stored scorer
 */
export const useScorerVersion = ({ scorerId, versionId }: { scorerId: string; versionId: string }) => {
  const client = useMastraClient();

  return useQuery<ScorerVersionResponse>({
    queryKey: ['scorer-version', scorerId, versionId],
    queryFn: () => client.getStoredScorer(scorerId).getVersion(versionId),
    enabled: !!scorerId && !!versionId,
  });
};

/**
 * Hook to create a new version of a stored scorer
 */
export const useCreateScorerVersion = ({ scorerId }: { scorerId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ScorerVersionResponse, Error, CreateScorerVersionParams | undefined>({
    mutationFn: (params?: CreateScorerVersionParams) => client.getStoredScorer(scorerId).createVersion(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
      void queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
    },
  });
};

/**
 * Hook to activate a specific version of a stored scorer
 */
export const useActivateScorerVersion = ({ scorerId }: { scorerId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ActivateScorerVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredScorer(scorerId).activateVersion(versionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
      void queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
    },
  });
};

/**
 * Hook to restore a specific version of a stored scorer (creates a new version from an old one)
 */
export const useRestoreScorerVersion = ({ scorerId }: { scorerId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ScorerVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredScorer(scorerId).restoreVersion(versionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
      void queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
    },
  });
};

/**
 * Hook to delete a specific version of a stored scorer
 */
export const useDeleteScorerVersion = ({ scorerId }: { scorerId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<DeleteScorerVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredScorer(scorerId).deleteVersion(versionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
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

  return useQuery<CompareScorerVersionsResponse>({
    queryKey: ['scorer-versions-compare', scorerId, fromVersionId, toVersionId],
    queryFn: () => client.getStoredScorer(scorerId).compareVersions(fromVersionId, toVersionId),
    enabled: !!scorerId && !!fromVersionId && !!toVersionId,
  });
};
