import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import type {
  ListAgentVersionsParams,
  CreateAgentVersionParams,
  ListAgentVersionsResponse,
  AgentVersionResponse,
  CompareVersionsResponse,
  ActivateAgentVersionResponse,
} from '@mastra/client-js';

export type { ListAgentVersionsParams, CreateAgentVersionParams };

/**
 * Hook to list versions of a stored agent
 */
export const useAgentVersions = ({ agentId, params }: { agentId: string; params?: ListAgentVersionsParams }) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery<ListAgentVersionsResponse>({
    queryKey: ['agent-versions', agentId, params, requestContext],
    queryFn: () => client.getStoredAgent(agentId).listVersions(params, requestContext),
    enabled: !!agentId,
  });
};

/**
 * Hook to get a single version of a stored agent
 */
export const useAgentVersion = ({ agentId, versionId }: { agentId: string; versionId: string }) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery<AgentVersionResponse>({
    queryKey: ['agent-version', agentId, versionId, requestContext],
    queryFn: () => client.getStoredAgent(agentId).getVersion(versionId, requestContext),
    enabled: !!agentId && !!versionId,
  });
};

/**
 * Hook to create a new version of a stored agent
 */
export const useCreateAgentVersion = ({ agentId }: { agentId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<AgentVersionResponse, Error, CreateAgentVersionParams | undefined>({
    mutationFn: (params?: CreateAgentVersionParams) =>
      client.getStoredAgent(agentId).createVersion(params, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });
};

/**
 * Hook to activate a specific version of a stored agent
 */
export const useActivateAgentVersion = ({ agentId }: { agentId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<ActivateAgentVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).activateVersion(versionId, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });
};

/**
 * Hook to restore a specific version of a stored agent (creates a new version from an old one)
 */
export const useRestoreAgentVersion = ({ agentId }: { agentId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<AgentVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).restoreVersion(versionId, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });
};

/**
 * Hook to delete a specific version of a stored agent
 */
export const useDeleteAgentVersion = ({ agentId }: { agentId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<void, Error, string>({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).deleteVersion(versionId, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
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
  const { requestContext } = usePlaygroundStore();

  return useQuery<CompareVersionsResponse>({
    queryKey: ['agent-versions-compare', agentId, fromVersionId, toVersionId, requestContext],
    queryFn: () => client.getStoredAgent(agentId).compareVersions(fromVersionId, toVersionId, requestContext),
    enabled: !!agentId && !!fromVersionId && !!toVersionId,
  });
};
