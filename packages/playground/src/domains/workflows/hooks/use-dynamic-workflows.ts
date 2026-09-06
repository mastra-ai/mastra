import type { ListDynamicWorkflowsParams, UpsertDynamicWorkflowParams } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usePlaygroundStore } from '@/store/playground-store';

export const dynamicWorkflowKeys = {
  all: ['dynamic-workflows'] as const,
  lists: () => [...dynamicWorkflowKeys.all, 'list'] as const,
  list: (params?: ListDynamicWorkflowsParams) => [...dynamicWorkflowKeys.lists(), params] as const,
  details: () => [...dynamicWorkflowKeys.all, 'detail'] as const,
  detail: (workflowId: string) => [...dynamicWorkflowKeys.details(), workflowId] as const,
};

export function useDynamicWorkflows(params?: ListDynamicWorkflowsParams, options?: { enabled?: boolean }) {
  const client = useMastraClient();

  return useQuery({
    queryKey: dynamicWorkflowKeys.list(params),
    queryFn: () => client.listDynamicWorkflows(params),
    enabled: options?.enabled !== false,
  });
}

export function useDynamicWorkflow(workflowId: string | undefined) {
  const client = useMastraClient();

  return useQuery({
    queryKey: dynamicWorkflowKeys.detail(workflowId ?? ''),
    queryFn: () => client.getDynamicWorkflow(workflowId!).details(),
    enabled: Boolean(workflowId),
  });
}

export function useUpsertDynamicWorkflow() {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: (definition: UpsertDynamicWorkflowParams) => client.upsertDynamicWorkflow(definition),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dynamicWorkflowKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['workflows', requestContext] }),
      ]);
    },
  });
}

export function useDeleteDynamicWorkflow() {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: (workflowId: string) => client.getDynamicWorkflow(workflowId).delete(),
    onSuccess: async (_response, workflowId) => {
      queryClient.removeQueries({ queryKey: dynamicWorkflowKeys.detail(workflowId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dynamicWorkflowKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: ['workflows', requestContext] }),
      ]);
    },
  });
}
