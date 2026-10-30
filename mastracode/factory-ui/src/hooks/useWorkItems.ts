import type { FactoryRuleStage } from '@mastra/factory/rules/types';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { useMemo } from 'react';
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
  listWorkItemSources,
  listWorkItems,
  syncWorkItems,
  transitionWorkItem,
  updateWorkItem,
} from '../ui/domains/factory/services/workItems';
import type {
  BoardSnapshot,
  CreateWorkItemInput,
  FactoryBoard,
  UpdateWorkItemInput,
  WorkItem,
  WorkItemSourceRef,
  WorkItemStageEntry,
  WorkItemSync,
} from '../ui/domains/factory/services/workItems';

function requireFactoryProjectId(factoryProjectId: string | undefined): string {
  if (!factoryProjectId) throw new Error('No Factory selected');
  return factoryProjectId;
}

/** Rewrite the cached board's cards, keeping the session activity read alongside them. */
function patchCards(queryClient: QueryClient, listKey: QueryKey, patch: (cards: WorkItem[]) => WorkItem[]) {
  // Returning undefined skips the write: never seed a partial board before the list query loads.
  queryClient.setQueryData<BoardSnapshot>(listKey, board =>
    board ? { ...board, workItems: patch(board.workItems) } : undefined,
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
const selectCounts = (board: BoardSnapshot) => board.counts;
const selectParkedSessions = (board: BoardSnapshot): ReadonlySet<string> => new Set(board.parkedSessionIds);
const NO_SESSIONS: ReadonlySet<string> = new Set();
const NO_SOURCES: WorkItemSourceRef[] = [];
const NO_CARDS: WorkItem[] = [];

/**
 * How long the board trusts deltas before syncing from scratch. A full sync drops cards that went Done
 * or Canceled in the meantime and catches any write a delta could miss (one committed long after it was
 * stamped); on the Factory's own project it is ~1,300 open cards, a fraction of the full list.
 */
export const BOARD_RESYNC_MS = 5 * 60_000;

/** Fold a sync into the board: a reset replaces the cards, a delta replaces only the ones it names. */
export function applyBoardSync(previous: BoardSnapshot | undefined, sync: WorkItemSync, now: number): BoardSnapshot {
  const sessions = {
    runningSessionIds: sync.runningSessionIds,
    parkedSessionIds: sync.parkedSessionIds,
    cursor: sync.cursor,
    counts: sync.counts,
  };
  if (sync.reset || !previous) return { workItems: sync.workItems, ...sessions, resetAt: now };
  const gone = new Set(sync.deletedIds);
  const changed = new Map(sync.workItems.map(item => [item.id, item]));
  const kept = previous.workItems.flatMap(item => {
    if (gone.has(item.id)) return [];
    const next = changed.get(item.id);
    changed.delete(item.id);
    return [next ?? item];
  });
  return { workItems: [...changed.values(), ...kept], ...sessions, resetAt: previous.resetAt };
}

export function boardQueryOptions(baseUrl: string, factoryProjectId: string | undefined) {
  const queryKey = queryKeys.workItems(factoryProjectId);
  return queryOptions({
    queryKey,
    queryFn: factoryProjectId
      ? async ({ signal, client }) => {
          const before = client.getQueryData<BoardSnapshot>(queryKey);
          const fresh = before?.resetAt !== undefined && Date.now() - before.resetAt < BOARD_RESYNC_MS;
          const sync = await syncWorkItems(baseUrl, factoryProjectId, fresh ? before.cursor : undefined, signal);
          // A resync drops cards that closed since the last one; the Done pages read them again.
          if (sync.reset && before) {
            void client.invalidateQueries({ queryKey: queryKeys.workItemArchiveRoot(factoryProjectId) });
          }
          // Read again: an optimistic edit may have landed while the sync was in flight.
          return applyBoardSync(sync.reset ? undefined : client.getQueryData<BoardSnapshot>(queryKey), sync, Date.now());
        }
      : skipToken,
    // The feed stream refetches on every board write; this only backs it up for a dropped stream
    // and for writes that bump no card, like a session starting or parking.
    refetchInterval: 30_000,
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

/** Cards per board and phase as the server counts them, Done and Canceled cards the board never loaded included. */
export function useBoardCounts(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({ ...boardQueryOptions(baseUrl, factoryProjectId), select: selectCounts }).data;
}

export function workItemSourcesQueryOptions(baseUrl: string, factoryProjectId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.workItemSources(factoryProjectId),
    queryFn: factoryProjectId ? ({ signal }) => listWorkItemSources(baseUrl, factoryProjectId, signal) : skipToken,
    // Cards the board loads cover everything filed since; this list only has to catch the old ones.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** The source of every card on the project, Done and Canceled included, so Intake never re-offers one. */
export function useWorkItemSources(factoryProjectId: string | undefined): WorkItemSourceRef[] {
  const { baseUrl } = useApiConfig();
  return useQuery(workItemSourcesQueryOptions(baseUrl, factoryProjectId)).data ?? NO_SOURCES;
}

/**
 * Every card on the project, Done and Canceled included. Read once and kept for a few minutes rather
 * than polled: only lookups that miss the board need it.
 */
export function workItemHistoryQueryOptions(baseUrl: string, factoryProjectId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.workItemHistory(factoryProjectId),
    queryFn: factoryProjectId ? ({ signal }) => listWorkItems(baseUrl, factoryProjectId, signal) : skipToken,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    select: selectCards,
  });
}

/**
 * The board's cards, plus every older one once `needsHistory` says the board alone falls short.
 * Board cards win over their history copies, since the board is synced and patched by every edit.
 */
export function useWorkItemsWithHistory(
  factoryProjectId: string | undefined,
  needsHistory: boolean | ((cards: WorkItem[]) => boolean),
) {
  const { baseUrl } = useApiConfig();
  const board = useWorkItemsQuery(factoryProjectId);
  const cards = board.data ?? NO_CARDS;
  const enabled = board.isSuccess && (typeof needsHistory === 'function' ? needsHistory(cards) : needsHistory);
  const history = useQuery({ ...workItemHistoryQueryOptions(baseUrl, factoryProjectId), enabled });
  const data = useMemo(() => {
    if (!board.data || !history.data) return board.data;
    const onBoard = new Set(board.data.map(item => item.id));
    return [...board.data, ...history.data.filter(item => !onBoard.has(item.id))];
  }, [board.data, history.data]);
  const settled = !enabled || history.isFetched;
  return {
    data,
    isSuccess: board.isSuccess && settled,
    isPending: board.isPending || !settled,
    isFetched: board.isFetched,
    isLoading: board.isLoading || (enabled && history.isLoading),
    isError: board.isError,
    dataUpdatedAt: board.dataUpdatedAt,
    refetch: board.refetch,
  };
}

/** Sessions parked on a plan or a question, read with the cards so a card and its marker agree. */
export function useParkedSessions(factoryProjectId: string | undefined): ReadonlySet<string> {
  const { baseUrl } = useApiConfig();
  const { data } = useQuery({ ...boardQueryOptions(baseUrl, factoryProjectId), select: selectParkedSessions });
  return data ?? NO_SESSIONS;
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
  reenter?: boolean;
};

function optimisticStageHistory(
  item: WorkItem,
  stage: string,
  enteredAt: string,
  by: string,
  reenter: boolean,
): WorkItemStageEntry[] {
  if (reenter) return item.stageHistory;
  const next = item.stageHistory.map(entry => ({ ...entry }));
  for (const oldStage of item.stages) {
    if (oldStage === stage) continue;
    for (let index = next.length - 1; index >= 0; index -= 1) {
      const entry = next[index];
      if (entry?.stage === oldStage && entry.exitedAt === undefined) {
        next[index] = { ...entry, exitedAt: enteredAt, exitedBy: by };
        break;
      }
    }
  }
  if (!item.stages.includes(stage)) next.push({ stage, enteredAt, by });
  return next;
}

export function useTransitionWorkItemMutation(factoryProjectId: string | undefined, currentUserId?: string) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const listKey = queryKeys.workItems(factoryProjectId);
  const mutationKey = ['factory', 'transition-work-item', factoryProjectId] as const;
  const mutation = useMutation({
    mutationKey,
    mutationFn: ({ item, board, stage, cause = 'board_drag', reenter }: TransitionWorkItemVariables) =>
      transitionWorkItem(baseUrl, requireFactoryProjectId(factoryProjectId), item.id, {
        board,
        stage,
        expectedRevision: item.revision,
        requestId: crypto.randomUUID(),
        cause,
        ...(reenter ? { reenter } : {}),
      }),
    onMutate: async ({ item, stage, reenter = false }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previousItem = queryClient
        .getQueryData<BoardSnapshot>(listKey)
        ?.workItems.find(candidate => candidate.id === item.id);
      const enteredAt = new Date().toISOString();
      const actor = currentUserId ?? 'factory:optimistic';
      // A Done or Canceled card read from an archive page is not on the board yet; adding it lets the
      // move show at once, and the board copy wins over the stale archive one.
      patchCards(queryClient, listKey, cards =>
        (cards.some(candidate => candidate.id === item.id) ? cards : [item, ...cards]).map(candidate =>
          candidate.id === item.id
            ? {
                ...candidate,
                stages: [stage],
                stageHistory: optimisticStageHistory(candidate, stage, enteredAt, actor, reenter),
              }
            : candidate,
        ),
      );
      return { previousItem, enteredAt, actor };
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
    onSuccess: async (result, variables, context) => {
      patchCards(queryClient, listKey, cards =>
        cards.map(item => {
          if (item.id !== variables.item.id || item.revision !== variables.item.revision) return item;
          if (result.status === 'rejected') return context?.previousItem ?? item;
          if (result.revision <= item.revision) return item;
          const previousItem = context?.previousItem ?? variables.item;
          return {
            ...item,
            stages: [result.stage],
            stageHistory: optimisticStageHistory(
              previousItem,
              result.stage,
              context?.enteredAt ?? new Date().toISOString(),
              context?.actor ?? currentUserId ?? 'factory:optimistic',
              variables.reenter ?? false,
            ),
            revision: result.revision,
          };
        }),
      );
      // The lane's rule queues its run inside this commit. Awaiting both refetches keeps the
      // move pending until the card shows that run, so its button never reappears in between.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.factoryDecisionsRoot(factoryProjectId) }),
      ]);
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
  if (!('stage' in value) || typeof value.stage !== 'string') return false;
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
      // patchCards keeps the snapshot's session markers, so refetch to drop the deleted card's with it.
      void queryClient.invalidateQueries({ queryKey: listKey });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItemArchiveRoot(factoryProjectId) });
    },
  });
}
