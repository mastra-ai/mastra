import type {
  MastraClient,
  ReorderModelListParams,
  UpdateModelInModelListParams,
  UpdateModelParams,
} from '@mastra/client-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';

type Agent = ReturnType<MastraClient['getAgent']>;
type ListAgentsResponse = Awaited<ReturnType<MastraClient['listAgents']>>;
export type ModelUpdateResponse = Awaited<ReturnType<Agent['updateModel']>>;

export const useAgents = <TData = ListAgentsResponse>({
  requestContext,
  queryOptions,
}: {
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<ListAgentsResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agents', requestContext],
    queryFn: () => client.listAgents(requestContext),
    ...queryOptions,
  });
};

export const useUpdateAgentModel = ({
  agentId,
  queryOptions,
}: {
  agentId: string;
  queryOptions?: MastraMutationOptions<ModelUpdateResponse, UpdateModelParams>;
}): UseMutationResult<ModelUpdateResponse, Error, UpdateModelParams> => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateModelParams) => client.getAgent(agentId).updateModel(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error updating model', err);
    },
    ...queryOptions,
  });
};

export const useReorderModelList = ({
  agentId,
  queryOptions,
}: {
  agentId: string;
  queryOptions?: MastraMutationOptions<ModelUpdateResponse, ReorderModelListParams>;
}): UseMutationResult<ModelUpdateResponse, Error, ReorderModelListParams> => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ReorderModelListParams) => client.getAgent(agentId).reorderModelList(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error reordering model list', err);
    },
    ...queryOptions,
  });
};

export const useUpdateModelInModelList = ({
  agentId,
  queryOptions,
}: {
  agentId: string;
  queryOptions?: MastraMutationOptions<ModelUpdateResponse, UpdateModelInModelListParams>;
}): UseMutationResult<ModelUpdateResponse, Error, UpdateModelInModelListParams> => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateModelInModelListParams) =>
      client.getAgent(agentId).updateModelInModelList(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error updating model in model list', err);
    },
    ...queryOptions,
  });
};

export const useResetAgentModel = ({
  agentId,
  queryOptions,
}: {
  agentId: string;
  queryOptions?: MastraMutationOptions<ModelUpdateResponse, void>;
}): UseMutationResult<ModelUpdateResponse, Error, void> => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => client.getAgent(agentId).resetModel(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error resetting model', err);
    },
    ...queryOptions,
  });
};
