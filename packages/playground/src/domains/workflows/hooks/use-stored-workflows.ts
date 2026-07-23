import type { ListStoredWorkflowsParams, UpsertStoredWorkflowParams } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usePlaygroundStore } from '@/store/playground-store';

export const storedWorkflowKeys = {
  all: ['stored-workflows'] as const,
  lists: () => [...storedWorkflowKeys.all, 'list'] as const,
  list: (params?: ListStoredWorkflowsParams) => [...storedWorkflowKeys.lists(), params] as const,
  details: () => [...storedWorkflowKeys.all, 'detail'] as const,
  detail: (workflowId: string) => [...storedWorkflowKeys.details(), workflowId] as const,
};

export function useStoredWorkflows(params?: ListStoredWorkflowsParams, options?: { enabled?: boolean }) {
  const client = useMastraClient();

  return useQuery({
    queryKey: storedWorkflowKeys.list(params),
    queryFn: () => client.listStoredWorkflows(params),
    enabled: options?.enabled !== false,
  });
}

export function useStoredWorkflow(workflowId: string | undefined) {
  const client = useMastraClient();

  return useQuery({
    queryKey: storedWorkflowKeys.detail(workflowId ?? ''),
    queryFn: () => client.getStoredWorkflow(workflowId!).details(),
    enabled: Boolean(workflowId),
  });
}

export function useUpsertStoredWorkflow() {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: (definition: UpsertStoredWorkflowParams) => client.upsertStoredWorkflow(definition),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: storedWorkflowKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['workflows', requestContext] }),
      ]);
    },
  });
}

export function useDeleteStoredWorkflow() {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: (workflowId: string) => client.getStoredWorkflow(workflowId).delete(),
    onSuccess: async (_response, workflowId) => {
      queryClient.removeQueries({ queryKey: storedWorkflowKeys.detail(workflowId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: storedWorkflowKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: ['workflows', requestContext] }),
      ]);
    },
  });
}
