import type { UseQueryResult } from '@tanstack/react-query';
import type {
  ListAgentVersionsParams,
  CreateAgentVersionParams,
  ListAgentVersionsResponse,
  AgentVersionResponse,
  CompareVersionsResponse,
  ActivateAgentVersionResponse,
  DeleteAgentVersionResponse,
} from '@mastra/client-js';
import { useQuery, useMutation, useQueryClient, skipToken } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';

export type { ListAgentVersionsParams, CreateAgentVersionParams };

type UseAgentVersionsParams<TData = ListAgentVersionsResponse> = {
  agentId?: string;
  params?: ListAgentVersionsParams;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<ListAgentVersionsResponse, TData>;
};

/**
 * Hook to list versions of a stored agent
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useAgentVersions = <TData = ListAgentVersionsResponse>({
  agentId,
  params,
  requestContext,
  queryOptions,
}: UseAgentVersionsParams<TData>): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<ListAgentVersionsResponse, Error, TData>({
    queryKey: ['agent-versions', agentId, params, requestContext],
    queryFn: agentId ? () => client.getStoredAgent(agentId).listVersions(params, requestContext) : skipToken,
    ...queryOptions,
  });
};

/**
 * Hook to get a single version of a stored agent
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useAgentVersion = <TData = AgentVersionResponse>({
  agentId,
  versionId,
  requestContext,
  queryOptions,
}: {
  agentId: string;
  versionId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<AgentVersionResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<AgentVersionResponse, Error, TData>({
    queryKey: ['agent-version', agentId, versionId, requestContext],
    queryFn: () => client.getStoredAgent(agentId).getVersion(versionId, requestContext),
    ...queryOptions,
  });
};

/**
 * Hook to create a new version of a stored agent
 */
export const useCreateAgentVersion = ({
  agentId,
  requestContext,
  queryOptions,
}: {
  agentId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<AgentVersionResponse, CreateAgentVersionParams | undefined>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<AgentVersionResponse, Error, CreateAgentVersionParams | undefined>({
    mutationFn: (params?: CreateAgentVersionParams) =>
      client.getStoredAgent(agentId).createVersion(params, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    ...queryOptions,
  });
};

/**
 * Hook to activate a specific version of a stored agent
 */
export const useActivateAgentVersion = ({
  agentId,
  requestContext,
  queryOptions,
}: {
  agentId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<ActivateAgentVersionResponse, string>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ActivateAgentVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).activateVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    ...queryOptions,
  });
};

/**
 * Hook to restore a specific version of a stored agent (creates a new version from an old one)
 */
export const useRestoreAgentVersion = ({
  agentId,
  requestContext,
  queryOptions,
}: {
  agentId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<AgentVersionResponse, string>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<AgentVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).restoreVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    ...queryOptions,
  });
};

/**
 * Hook to delete a specific version of a stored agent
 */
export const useDeleteAgentVersion = ({
  agentId,
  requestContext,
  queryOptions,
}: {
  agentId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<DeleteAgentVersionResponse, string>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<DeleteAgentVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).deleteVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
    },
    ...queryOptions,
  });
};

/**
 * Hook to compare two versions of a stored agent
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useCompareAgentVersions = <TData = CompareVersionsResponse>({
  agentId,
  fromVersionId,
  toVersionId,
  requestContext,
  queryOptions,
}: {
  agentId: string;
  fromVersionId: string;
  toVersionId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<CompareVersionsResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<CompareVersionsResponse, Error, TData>({
    queryKey: ['agent-versions-compare', agentId, fromVersionId, toVersionId, requestContext],
    queryFn: () => client.getStoredAgent(agentId).compareVersions(fromVersionId, toVersionId, requestContext),
    ...queryOptions,
  });
};
