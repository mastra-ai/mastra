import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  createWorkItem,
  deleteWorkItem,
  listWorkItems,
  transitionWorkItem,
  updateWorkItem,
} from '../../web/ui/domains/factory/services/workItems';
import type {
  CreateWorkItemInput,
  UpdateWorkItemInput,
  WorkItem,
} from '../../web/ui/domains/factory/services/workItems';

/** The org's persisted work items (kanban cards) for a project. */
export function useWorkItemsQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.workItems(factoryProjectId),
    queryFn: () => listWorkItems(baseUrl, factoryProjectId!),
    enabled: Boolean(factoryProjectId),
    // Relationships can be created by GitHub ingestion or another open tab.
    // Keep thread-page counterpart links current without requiring a reload.
    refetchInterval: 5_000,
  });
}

/**
 * Materialize a work item (the server upserts on `sourceKey`, so acting twice
 * on the same issue reuses the card). The list cache is patched in place.
 */
export function useUpsertWorkItemMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkItemInput) => createWorkItem(baseUrl, factoryProjectId!, input),
    onSuccess: item => {
      queryClient.setQueryData<WorkItem[]>(queryKeys.workItems(factoryProjectId), existing => {
        const rest = (existing ?? []).filter(i => i.id !== item.id);
        return [item, ...rest];
      });
    },
  });
}

/** Patch non-stage work-item fields. Stage movement uses the transition authority below. */
export function useUpdateWorkItemMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const listKey = queryKeys.workItems(factoryProjectId);
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateWorkItemInput }) => updateWorkItem(baseUrl, id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<WorkItem[]>(listKey);
      if (previous && patch.parentWorkItemId !== undefined) {
        queryClient.setQueryData<WorkItem[]>(
          listKey,
          previous.map(item => (item.id === id ? { ...item, parentWorkItemId: patch.parentWorkItemId ?? null } : item)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },
    onSuccess: item => {
      queryClient.setQueryData<WorkItem[]>(listKey, existing =>
        (existing ?? []).map(i => (i.id === item.id ? item : i)),
      );
    },
  });
}

export function useTransitionWorkItemMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const listKey = queryKeys.workItems(factoryProjectId);
  return useMutation({
    mutationFn: ({ item, board, stage }: { item: WorkItem; board: 'work' | 'review'; stage: string }) =>
      transitionWorkItem(baseUrl, factoryProjectId!, item.id, {
        board,
        stage: stage as 'intake' | 'triage' | 'planning' | 'execute' | 'review' | 'done',
        expectedRevision: item.revision,
        requestId: crypto.randomUUID(),
        cause: 'board_drag',
      }),
    onMutate: async ({ item, stage }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<WorkItem[]>(listKey);
      queryClient.setQueryData<WorkItem[]>(listKey, existing =>
        (existing ?? []).map(candidate => (candidate.id === item.id ? { ...candidate, stages: [stage] } : candidate)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },
    onSuccess: (result, _variables, context) => {
      if (result.status === 'rejected' && context?.previous) queryClient.setQueryData(listKey, context.previous);
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
}

/** Remove a work item from the board, dropping it from the cache optimistically. */
export function useDeleteWorkItemMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const listKey = queryKeys.workItems(factoryProjectId);
  return useMutation({
    mutationFn: (id: string) => deleteWorkItem(baseUrl, id),
    onMutate: async id => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<WorkItem[]>(listKey);
      if (previous) {
        queryClient.setQueryData<WorkItem[]>(
          listKey,
          previous.filter(item => item.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },
  });
}
