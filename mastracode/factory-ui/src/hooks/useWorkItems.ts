import type { FactoryRuleStage } from '@mastra/factory/rules/types';
import { isFactoryRuleStage } from '@mastra/factory/rules/types';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import {
  queryOptions,
  skipToken,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

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
  BoardSnapshot,
  CreateWorkItemInput,
  FactoryBoard,
  UpdateWorkItemInput,
  WorkItem,
} from '../ui/domains/factory/services/workItems';

function requireFactoryProjectId(factoryProjectId: string | undefined): string {
  if (!factoryProjectId) throw new Error('No Factory selected');
  return factoryProjectId;
}

/** Rewrite the cached board's cards, keeping the run activity read alongside them. */
function patchCards(queryClient: QueryClient, listKey: QueryKey, patch: (cards: WorkItem[]) => WorkItem[]) {
  // Returning undefined skips the write: never seed a partial board before the list query loads.
  queryClient.setQueryData<BoardSnapshot>(listKey, board =>
    board ? { runningSessionIds: board.runningSessionIds, workItems: patch(board.workItems) } : undefined,
  );
}

/** Drop every card ref to a deleted session so the board stops advertising it before the next poll. */
export function stripCachedSessionRefs(queryClient: QueryClient, factoryProjectId: string, sessionId: string) {
  // an in-flight list fetch still carries the stale refs and would clobber the edit below
  void queryClient.cancelQueries({ queryKey: queryKeys.workItems(factoryProjectId) });
  patchCards(queryClient, queryKeys.workItems(factoryProjectId), cards =>
    cards.map(card => {
      const kept = Object.entries(card.sessions).filter(([, ref]) => ref.sessionId !== sessionId);
      return kept.length === Object.keys(card.sessions).length ? card : { ...card, sessions: Object.fromEntries(kept) };
    }),
  );
}

// Module-level so React Query can cache each derived value instead of
// rebuilding it (and, for the set, breaking referential equality) per render.
const selectCards = (board: BoardSnapshot) => board.workItems;
const selectRunningSessions = (board: BoardSnapshot): ReadonlySet<string> => new Set(board.runningSessionIds);
const NO_RUNNING_SESSIONS: ReadonlySet<string> = new Set();

export function boardQueryOptions(baseUrl: string, factoryProjectId: string | undefined) {
  return queryOptions({
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

/** The org's persisted work items (kanban cards) for a project. */
export function useWorkItemsQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({ ...boardQueryOptions(baseUrl, factoryProjectId), select: selectCards });
}

/**
 * Sessions with an agent run in flight, taken from the same read as the cards
 * they belong to — a card and its run marker can never come from two polls.
 */
export function useRunningSessions(factoryProjectId: string | undefined): ReadonlySet<string> {
  const { baseUrl } = useApiConfig();
  const { data } = useQuery({ ...boardQueryOptions(baseUrl, factoryProjectId), select: selectRunningSessions });
  return data ?? NO_RUNNING_SESSIONS;
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
      patchCards(queryClient, queryKeys.workItems(factoryProjectId), cards => [
        item,
        ...cards.filter(i => i.id !== item.id),
      ]);
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
      const previous = queryClient.getQueryData<BoardSnapshot>(listKey);
      if (patch.parentWorkItemId !== undefined) {
        patchCards(queryClient, listKey, cards =>
          cards.map(item => (item.id === id ? { ...item, parentWorkItemId: patch.parentWorkItemId ?? null } : item)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },
    onSuccess: item => {
      patchCards(queryClient, listKey, cards => cards.map(i => (i.id === item.id ? item : i)));
    },
  });
}

type TransitionWorkItemVariables = {
  item: WorkItem;
  board: FactoryBoard;
  stage: string;
  cause?: string;
};

function requireFactoryStage(stage: string): FactoryRuleStage {
  if (!isFactoryRuleStage(stage)) throw new Error(`Unsupported Factory stage: ${stage}`);
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
      const previousItem = queryClient
        .getQueryData<BoardSnapshot>(listKey)
        ?.workItems.find(candidate => candidate.id === item.id);
      patchCards(queryClient, listKey, cards =>
        cards.map(candidate => (candidate.id === item.id ? { ...candidate, stages: [stage] } : candidate)),
      );
      return { previousItem };
    },
    onError: (_error, variables, context) => {
      const previousItem = context?.previousItem;
      if (!previousItem) return;
      patchCards(queryClient, listKey, cards =>
        cards.map(item => {
          if (item.id !== variables.item.id || item.revision !== variables.item.revision) return item;
          return previousItem;
        }),
      );
    },
    onSuccess: (result, variables, context) => {
      patchCards(queryClient, listKey, cards =>
        cards.map(item => {
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
  stage: FactoryRuleStage;
}

function isPendingTransitionVariables(value: unknown): value is PendingTransitionVariables {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if (!('stage' in value) || !isFactoryRuleStage(value.stage)) return false;
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
      const previous = queryClient.getQueryData<BoardSnapshot>(listKey);
      patchCards(queryClient, listKey, cards => cards.filter(item => item.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },
    onSuccess: () => {
      // patchCards keeps runningSessionIds, so refetch to drop the deleted card's run marker with it.
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
}
