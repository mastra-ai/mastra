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
export const useAgentVersions = (
  { agentId, params, enabled = true }: UseAgentVersionsParams,
  requestContext?: Record<string, any>,
) => {
  const client = useMastraClient();

  return useQuery<ListAgentVersionsResponse>({
    queryKey: ['agent-versions', agentId, params, requestContext],
    queryFn: agentId ? () => client.getStoredAgent(agentId).listVersions(params, requestContext) : skipToken,
    enabled,
  });
};

/**
 * Hook to get a single version of a stored agent
 */
export const useAgentVersion = (
  { agentId, versionId }: { agentId: string; versionId: string },
  requestContext?: Record<string, any>,
) => {
  const client = useMastraClient();

  return useQuery<AgentVersionResponse>({
    queryKey: ['agent-version', agentId, versionId, requestContext],
    queryFn: () => client.getStoredAgent(agentId).getVersion(versionId, requestContext),
    enabled: !!agentId && !!versionId,
  });
};

/**
 * Hook to create a new version of a stored agent
 */
export const useCreateAgentVersion = ({ agentId }: { agentId: string }, requestContext?: Record<string, any>) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<AgentVersionResponse, Error, CreateAgentVersionParams | undefined>({
    mutationFn: (params?: CreateAgentVersionParams) =>
      client.getStoredAgent(agentId).createVersion(params, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });
};

/**
 * Hook to activate a specific version of a stored agent
 */
export const useActivateAgentVersion = ({ agentId }: { agentId: string }, requestContext?: Record<string, any>) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ActivateAgentVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).activateVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });
};

/**
 * Hook to restore a specific version of a stored agent (creates a new version from an old one)
 */
export const useRestoreAgentVersion = ({ agentId }: { agentId: string }, requestContext?: Record<string, any>) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<AgentVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).restoreVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });
};

/**
 * Hook to delete a specific version of a stored agent
 */
export const useDeleteAgentVersion = ({ agentId }: { agentId: string }, requestContext?: Record<string, any>) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<DeleteAgentVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).deleteVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
    },
  });
};

/**
 * Hook to compare two versions of a stored agent
 */
export const useCompareAgentVersions = (
  {
    agentId,
    fromVersionId,
    toVersionId,
  }: {
    agentId: string;
    fromVersionId: string;
    toVersionId: string;
  },
  requestContext?: Record<string, any>,
) => {
  const client = useMastraClient();

  return useQuery<CompareVersionsResponse>({
    queryKey: ['agent-versions-compare', agentId, fromVersionId, toVersionId, requestContext],
    queryFn: () => client.getStoredAgent(agentId).compareVersions(fromVersionId, toVersionId, requestContext),
    enabled: !!agentId && !!fromVersionId && !!toVersionId,
  });
};
