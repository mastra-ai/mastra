import { skipToken, useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  createWorkItem,
  deleteWorkItem,
  listWorkItems,
  transitionWorkItem,
  updateWorkItem,
} from '../ui/domains/factory/services/workItems';
import type {
  CreateWorkItemInput,
  FactoryBoard,
  FactoryStage,
  UpdateWorkItemInput,
  WorkItem,
} from '../ui/domains/factory/services/workItems';

function requireFactoryProjectId(factoryProjectId: string | undefined): string {
  if (!factoryProjectId) throw new Error('No Factory selected');
  return factoryProjectId;
}

/** The org's persisted work items (kanban cards) for a project. */
export function useWorkItemsQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.workItems(factoryProjectId),
    queryFn: factoryProjectId ? ({ signal }) => listWorkItems(baseUrl, factoryProjectId, signal) : skipToken,
    // Relationships can be created by GitHub ingestion or another open tab.
    // Keep thread-page counterpart links current without requiring a reload.
    refetchInterval: 5_000,
    // Cards move autonomously (rule transitions, agent runs); polling pauses
    // while the tab is hidden, so refresh immediately on return.
    refetchOnWindowFocus: true,
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
    mutationFn: (input: CreateWorkItemInput) =>
      createWorkItem(baseUrl, requireFactoryProjectId(factoryProjectId), input),
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

type TransitionWorkItemVariables = {
  item: WorkItem;
  board: FactoryBoard;
  stage: string;
  cause?: string;
};

function isFactoryStage(stage: unknown): stage is FactoryStage {
  switch (stage) {
    case 'intake':
    case 'triage':
    case 'planning':
    case 'execute':
    case 'review':
    case 'done':
    case 'canceled':
      return true;
    default:
      return false;
  }
}

function requireFactoryStage(stage: string): FactoryStage {
  if (!isFactoryStage(stage)) throw new Error(`Unsupported Factory stage: ${stage}`);
  return stage;
}

export function useTransitionWorkItemMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const listKey = queryKeys.workItems(factoryProjectId);
  const mutationKey = ['factory', 'transition-work-item', factoryProjectId] as const;
  const mutation = useMutation({
    mutationKey,
    mutationFn: ({ item, board, stage, cause = 'board_drag' }: TransitionWorkItemVariables) =>
      transitionWorkItem(baseUrl, requireFactoryProjectId(factoryProjectId), item.id, {
        board,
        stage: requireFactoryStage(stage),
        expectedRevision: item.revision,
        requestId: crypto.randomUUID(),
        cause,
      }),
    onMutate: async ({ item, stage }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previousItem = queryClient.getQueryData<WorkItem[]>(listKey)?.find(candidate => candidate.id === item.id);
      queryClient.setQueryData<WorkItem[]>(listKey, existing =>
        (existing ?? []).map(candidate => (candidate.id === item.id ? { ...candidate, stages: [stage] } : candidate)),
      );
      return { previousItem };
    },
    onError: (_error, variables, context) => {
      const previousItem = context?.previousItem;
      if (!previousItem) return;
      queryClient.setQueryData<WorkItem[]>(listKey, existing =>
        (existing ?? []).map(item => {
          if (item.id !== variables.item.id || item.revision !== variables.item.revision) return item;
          return previousItem;
        }),
      );
    },
    onSuccess: (result, variables, context) => {
      queryClient.setQueryData<WorkItem[]>(listKey, existing =>
        (existing ?? []).map(item => {
          if (item.id !== variables.item.id || item.revision !== variables.item.revision) return item;
          if (result.status === 'rejected') return context?.previousItem ?? item;
          if (result.revision <= item.revision) return item;
          return { ...item, stages: [result.stage], revision: result.revision };
        }),
      );
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
  const pendingTransitions = useMutationState({
    filters: { mutationKey, status: 'pending' },
    select: pending => {
      const variables = pending.state.variables;
      return isPendingTransitionVariables(variables)
        ? { itemId: variables.item.id, stage: variables.stage }
        : undefined;
    },
  }).filter(transition => transition !== undefined);
  return { ...mutation, pendingTransitions };
}

interface PendingTransitionVariables {
  item: { id: string };
  stage: FactoryStage;
}

function isPendingTransitionVariables(value: unknown): value is PendingTransitionVariables {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if (!('stage' in value) || !isFactoryStage(value.stage)) return false;
  if (!('item' in value) || typeof value.item !== 'object' || value.item === null || !('id' in value.item))
    return false;
  return typeof value.item.id === 'string';
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
