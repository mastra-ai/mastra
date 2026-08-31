import type {
  ListAgentVersionsParams,
  CreateAgentVersionParams,
  ListAgentVersionsResponse,
  AgentVersionResponse,
  CompareVersionsResponse,
  ActivateAgentVersionResponse,
  ActivateAgentVersionInput,
  DeleteAgentVersionResponse,
} from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery, useMutation, useQueryClient, skipToken } from '@tanstack/react-query';
import { refreshAgentVersionMutationState } from './agent-version-mutation-cache';
import { agentVersionQueryKeys, invalidateAgentVersionState } from './agent-version-query-keys';
import { usePlaygroundStore } from '@/store/playground-store';

export type { ListAgentVersionsParams, CreateAgentVersionParams };

const COMPLETE_VERSION_PAGE_SIZE = 20;

type AgentVersionListItem = ListAgentVersionsResponse['versions'][number];

type UseAgentVersionsParams = {
  agentId?: string;
  params?: ListAgentVersionsParams;
  enabled?: boolean;
};

type UseAllAgentVersionsParams = {
  agentId?: string;
  params?: Omit<ListAgentVersionsParams, 'page' | 'perPage'>;
  enabled?: boolean;
};

const toCompleteVersionResponse = async (
  listPage: (page: number) => Promise<ListAgentVersionsResponse>,
): Promise<ListAgentVersionsResponse> => {
  const versions: AgentVersionListItem[] = [];
  const seenVersionIds = new Set<string>();
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await listPage(page);
    for (const version of response.versions) {
      if (seenVersionIds.has(version.id)) continue;
      seenVersionIds.add(version.id);
      versions.push(version);
    }
    hasMore = response.hasMore;
    page += 1;
  }

  return {
    versions,
    total: versions.length,
    page: 0,
    perPage: false,
    hasMore: false,
  };
};

/**
 * Hook to list versions of a stored agent
 */
export const useAgentVersions = ({ agentId, params, enabled = true }: UseAgentVersionsParams) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery<ListAgentVersionsResponse>({
    queryKey: agentVersionQueryKeys.versionList(agentId ?? '', params, requestContext),
    queryFn: agentId ? () => client.getStoredAgent(agentId).listVersions(params, requestContext) : skipToken,
    enabled,
  });
};

/** Lists the complete, deduplicated version history while preserving the server's page order. */
export const useAllAgentVersions = ({ agentId, params, enabled = true }: UseAllAgentVersionsParams) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery<ListAgentVersionsResponse>({
    queryKey: agentVersionQueryKeys.completeVersionList(agentId ?? '', params, requestContext),
    queryFn: agentId
      ? () =>
          toCompleteVersionResponse(page =>
            client.getStoredAgent(agentId).listVersions(
              {
                ...params,
                page,
                perPage: COMPLETE_VERSION_PAGE_SIZE,
              },
              requestContext,
            ),
          )
      : skipToken,
    enabled,
  });
};

/**
 * Hook to get a single version of a stored agent
 */
export const useAgentVersion = ({ agentId, versionId }: { agentId: string; versionId: string }) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery<AgentVersionResponse>({
    queryKey: agentVersionQueryKeys.versionDetail(agentId, versionId, requestContext),
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
    onSuccess: () => invalidateAgentVersionState(queryClient, agentId),
  });
};

/**
 * Hook to activate a specific version of a stored agent
 */
export const useActivateAgentVersion = ({ agentId }: { agentId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<ActivateAgentVersionResponse, Error, ActivateAgentVersionInput>({
    mutationFn: input => client.getStoredAgent(agentId).activateVersion(input, requestContext),
    onSuccess: () => invalidateAgentVersionState(queryClient, agentId),
    onError: error => refreshAgentVersionMutationState(queryClient, agentId, error),
    retry: false,
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
    onSuccess: () => invalidateAgentVersionState(queryClient, agentId),
  });
};

/**
 * Hook to delete a specific version of a stored agent
 */
export const useDeleteAgentVersion = ({ agentId }: { agentId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<DeleteAgentVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).deleteVersion(versionId, requestContext),
    onSuccess: () => invalidateAgentVersionState(queryClient, agentId),
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
