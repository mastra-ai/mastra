import type {
  ListAgentVersionsParams,
  CreateAgentVersionParams,
  ListAgentVersionsResponse,
  AgentVersionResponse,
  CompareVersionsResponse,
  ActivateAgentVersionResponse,
  DeleteAgentVersionResponse,
} from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery, useMutation, useQueryClient, skipToken } from '@tanstack/react-query';

export type { ListAgentVersionsParams, CreateAgentVersionParams };

type UseAgentVersionsParams = {
  agentId?: string;
  params?: ListAgentVersionsParams;
  enabled?: boolean;
};

/**
 * Hook to list versions of a stored agent
 */
export const useAgentVersions = ({ agentId, params, enabled = true }: UseAgentVersionsParams) => {
  const client = useMastraClient();

  return useQuery<ListAgentVersionsResponse>({
    queryKey: ['agent-versions', agentId, params],
    queryFn: agentId ? () => client.getStoredAgent(agentId).listVersions(params) : skipToken,
    enabled,
  });
};

/**
 * Hook to get a single version of a stored agent
 */
export const useAgentVersion = ({ agentId, versionId }: { agentId: string; versionId: string }) => {
  const client = useMastraClient();

  return useQuery<AgentVersionResponse>({
    queryKey: ['agent-version', agentId, versionId],
    queryFn: () => client.getStoredAgent(agentId).getVersion(versionId),
    enabled: !!agentId && !!versionId,
  });
};

/**
 * Hook to create a new version of a stored agent
 */
export const useCreateAgentVersion = ({ agentId }: { agentId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<AgentVersionResponse, Error, CreateAgentVersionParams | undefined>({
    mutationFn: (params?: CreateAgentVersionParams) => client.getStoredAgent(agentId).createVersion(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });
};

/**
 * Hook to activate a specific version of a stored agent
 */
export const useActivateAgentVersion = ({ agentId }: { agentId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ActivateAgentVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).activateVersion(versionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });
};

/**
 * Hook to restore a specific version of a stored agent (creates a new version from an old one)
 */
export const useRestoreAgentVersion = ({ agentId }: { agentId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<AgentVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).restoreVersion(versionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });
};

/**
 * Hook to delete a specific version of a stored agent
 */
export const useDeleteAgentVersion = ({ agentId }: { agentId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<DeleteAgentVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).deleteVersion(versionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
    },
  });
};

/**
 * Hook to compare two versions of a stored agent
 */
export const useCompareAgentVersions = ({
  agentId,
  fromVersionId,
  toVersionId,
}: {
  agentId: string;
  fromVersionId: string;
  toVersionId: string;
}) => {
  const client = useMastraClient();

  return useQuery<CompareVersionsResponse>({
    queryKey: ['agent-versions-compare', agentId, fromVersionId, toVersionId],
    queryFn: () => client.getStoredAgent(agentId).compareVersions(fromVersionId, toVersionId),
    enabled: !!agentId && !!fromVersionId && !!toVersionId,
  });
};
