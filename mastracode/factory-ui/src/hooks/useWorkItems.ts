import type { FactoryRuleStage } from '@mastra/factory/rules/types';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { useMemo } from 'react';
import {
  keepPreviousData,
  queryOptions,
  skipToken,
  useMutation,
  useMutationState,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  createWorkItem,
  deleteWorkItem,
  listWorkItemPage,
  listWorkItemSources,
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
  WorkItemPage,
  WorkItemSourceRef,
  WorkItemStageEntry,
  WorkItemSync,
} from '../ui/domains/factory/services/workItems';
import { isTerminalStage } from '../ui/domains/factory/stages';

function requireFactoryProjectId(factoryProjectId: string | undefined): string {
  if (!factoryProjectId) throw new Error('No Factory selected');
  return factoryProjectId;
}

/**
 * Rewrite the cards of every cached board snapshot under `listKey`: the full board and the board page's
 * lean change feed, keeping the session activity read alongside them.
 */
function patchCards(queryClient: QueryClient, listKey: QueryKey, patch: (cards: WorkItem[]) => WorkItem[]) {
  // Returning undefined skips the write: never seed a partial board before the list query loads.
  queryClient.setQueriesData<BoardSnapshot>({ queryKey: listKey }, board =>
    board ? { ...board, workItems: patch(board.workItems) } : undefined,
  );
}

/** A card as the cached snapshots under `listKey` last saw it. */
function cachedCard(queryClient: QueryClient, listKey: QueryKey, id: string): WorkItem | undefined {
  for (const [, board] of queryClient.getQueriesData<BoardSnapshot>({ queryKey: listKey })) {
    const card = board?.workItems.find(candidate => candidate.id === id);
    if (card) return card;
  }
  return undefined;
}

/** Every cached snapshot under `listKey`, to put back if an optimistic edit fails. */
function snapshotBoards(queryClient: QueryClient, listKey: QueryKey) {
  return queryClient.getQueriesData<BoardSnapshot>({ queryKey: listKey });
}

function restoreBoards(queryClient: QueryClient, boards: ReturnType<typeof snapshotBoards> | undefined) {
  for (const [key, board] of boards ?? []) queryClient.setQueryData(key, board);
}

/**
 * `overlay` over `base` by id: the copy with the higher revision wins, `overlay` on a tie since it is the
 * one optimistic edits patch. Ids in `gone` are dropped.
 */
export function mergeCards(
  base: readonly WorkItem[],
  overlay: readonly WorkItem[],
  gone: ReadonlySet<string> = new Set(),
): WorkItem[] {
  const byId = new Map<string, WorkItem>();
  for (const card of base) if (!gone.has(card.id)) byId.set(card.id, card);
  for (const card of overlay) {
    const current = byId.get(card.id);
    if (!current || card.revision >= current.revision) byId.set(card.id, card);
  }
  return [...byId.values()];
}

/** Drop every card ref to a deleted session so the board stops advertising it before the next poll. */
export function stripCachedSessionRefs(queryClient: QueryClient, factoryProjectId: string, sessionId: string) {
  // an in-flight list fetch still carries the stale refs and would clobber the edit below
  void queryClient.cancelQueries({ queryKey: queryKeys.workItems(factoryProjectId) });
  const strip = (card: WorkItem): WorkItem => {
    const kept = Object.entries(card.sessions).filter(([, ref]) => ref.sessionId !== sessionId);
    return kept.length === Object.keys(card.sessions).length ? card : { ...card, sessions: Object.fromEntries(kept) };
  };
  patchCards(queryClient, queryKeys.workItems(factoryProjectId), cards => cards.map(strip));
  // Column pages, the deep-linked card and lookups hold their own copies the lean sync only overlays once
  // the card changes again.
  queryClient.setQueriesData<unknown>(
    { queryKey: queryKeys.workItemColumnsRoot(factoryProjectId) },
    (data: unknown) => {
      if (!data || typeof data !== 'object') return data;
      if ('workItems' in data) {
        const page = data as WorkItemPage;
        return { ...page, workItems: page.workItems.map(strip) };
      }
      // Filtered counts share the root and carry no cards.
      return 'sessions' in data ? strip(data as WorkItem) : data;
    },
  );
  queryClient.setQueriesData<WorkItem[]>({ queryKey: queryKeys.workItemLookupRoot(factoryProjectId) }, cards =>
    cards?.map(strip),
  );
}

// Module-level so React Query can cache each derived value instead of
// rebuilding it (and, for the set, breaking referential equality) per render.
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
  if (sync.reset || !previous) return { workItems: sync.workItems, ...sessions, resetAt: now, deletedIds: [] };
  const gone = new Set(sync.deletedIds);
  const changed = new Map(sync.workItems.map(item => [item.id, item]));
  const kept = previous.workItems.flatMap(item => {
    if (gone.has(item.id)) return [];
    const next = changed.get(item.id);
    changed.delete(item.id);
    return [next ?? item];
  });
  return {
    workItems: [...changed.values(), ...kept],
    ...sessions,
    resetAt: previous.resetAt,
    deletedIds: [...new Set([...(previous.deletedIds ?? []), ...sync.deletedIds])],
  };
}

/**
 * The lean board sync: cursor, counts and session markers, plus only the cards written since its last
 * reset. Readers that page or look up their own cards lay these over them to stay current.
 */
export function boardChangesQueryOptions(baseUrl: string, factoryProjectId: string | undefined) {
  const queryKey = queryKeys.workItemChanges(factoryProjectId);
  return queryOptions({
    queryKey,
    queryFn: factoryProjectId
      ? async ({ signal, client }) => {
          const before = client.getQueryData<BoardSnapshot>(queryKey);
          const fresh = before?.resetAt !== undefined && Date.now() - before.resetAt < BOARD_RESYNC_MS;
          const sync = await syncWorkItems(baseUrl, factoryProjectId, fresh ? before.cursor : undefined, signal, {
            cards: 'changed',
          });
          // A resync catches writes a delta could miss; the column pages and lookups read their cards again.
          if (sync.reset && before) {
            void client.invalidateQueries({ queryKey: queryKeys.workItemColumnsRoot(factoryProjectId) });
            void client.invalidateQueries({ queryKey: queryKeys.workItemLookupRoot(factoryProjectId) });
          }
          // Read again: an optimistic edit may have landed while the sync was in flight.
          return applyBoardSync(
            sync.reset ? undefined : client.getQueryData<BoardSnapshot>(queryKey),
            sync,
            Date.now(),
          );
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

/** The lean board sync's snapshot; see {@link boardChangesQueryOptions}. */
export function useBoardChangesQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery(boardChangesQueryOptions(baseUrl, factoryProjectId));
}

/** Cards per board and phase as the server counts them, including every card no reader has loaded. */
export function useBoardCounts(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({ ...boardChangesQueryOptions(baseUrl, factoryProjectId), select: selectCounts }).data;
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

/** What a lookup asks the server for: the cards holding any of these sessions, or a session on any of these threads. */
export interface WorkItemLookup {
  kind: 'session' | 'thread';
  ids: readonly string[];
}

/**
 * The cards holding the given sessions or threads, Done and Canceled included, with their parents, children
 * and pull requests so relationship lookups resolve too. Kept for a few minutes rather than polled: cards on
 * the board come from the board, so these are mostly closed ones that no longer change.
 */
export function workItemLookupQueryOptions(
  baseUrl: string,
  factoryProjectId: string | undefined,
  lookup: WorkItemLookup | undefined,
) {
  const ids = lookup ? [...new Set(lookup.ids)].sort().join(',') : '';
  return queryOptions({
    queryKey: queryKeys.workItemLookup(factoryProjectId, lookup?.kind ?? 'session', ids),
    queryFn:
      factoryProjectId && lookup && ids
        ? async ({ signal }) =>
            (await listWorkItemPage(baseUrl, factoryProjectId, { [lookup.kind]: ids, related: '1' }, signal)).workItems
        : skipToken,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Ids per lookup read, so a long session list never builds an oversized URL. */
const LOOKUP_CHUNK = 40;

/**
 * The cards holding the given sessions or threads, read from the server instead of the full board, with
 * the lean board sync laid over them so a card written since they were read shows its latest copy.
 */
export function useLookedUpWorkItems(factoryProjectId: string | undefined, lookup: WorkItemLookup | undefined) {
  const { baseUrl } = useApiConfig();
  const changes = useBoardChangesQuery(factoryProjectId);
  const ids = lookup ? [...new Set(lookup.ids)].sort() : [];
  const idsKey = ids.join(',');
  const kind = lookup?.kind;
  const chunks: WorkItemLookup[] = [];
  for (let index = 0; lookup && index < ids.length; index += LOOKUP_CHUNK) {
    chunks.push({ kind: lookup.kind, ids: ids.slice(index, index + LOOKUP_CHUNK) });
  }
  const found = useQueries({
    queries: chunks.map(chunk => ({
      ...workItemLookupQueryOptions(baseUrl, factoryProjectId, chunk),
      placeholderData: keepPreviousData,
    })),
    combine: results => ({
      data: results.flatMap(result => result.data ?? NO_CARDS),
      isFetched: results.every(result => result.isFetched),
      isLoading: results.some(result => result.isLoading),
      isError: results.some(result => result.isError),
      error: results.find(result => result.error)?.error,
      refetch: () => Promise.all(results.map(result => result.refetch())),
    }),
  });
  const data = useMemo(() => {
    if (!changes.data) return found.data;
    const gone = new Set(changes.data.deletedIds);
    const looked = new Set(found.data.map(card => card.id));
    const wanted = new Set(idsKey.split(','));
    // Only changed cards the lookup names: the change feed also holds cards nobody asked about. A card
    // that took a looked-up session or thread since the read counts, so a new session shows at once.
    const overlay = changes.data.workItems.filter(
      card =>
        looked.has(card.id) ||
        Object.values(card.sessions).some(ref => wanted.has(kind === 'thread' ? ref.threadId : ref.sessionId)),
    );
    return mergeCards(found.data, overlay, gone);
  }, [found.data, changes.data, kind, idsKey]);
  const settled = chunks.length === 0 || found.isFetched;
  return {
    data,
    isSuccess: settled && !found.isError,
    isPending: !settled,
    isFetched: settled,
    isLoading: found.isLoading,
    isError: found.isError,
    error: found.error,
    refetch: found.refetch,
  };
}

/** Big enough for any real backlog of unstarted cards, which search filters locally. */
const UNSTARTED_LIMIT = 200;

/** Open cards no session has started yet, read on their own instead of with the full board. */
export function unstartedWorkItemsQueryOptions(baseUrl: string, factoryProjectId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.workItemsUnstarted(factoryProjectId),
    queryFn: factoryProjectId
      ? async ({ signal }) =>
          (
            await listWorkItemPage(
              baseUrl,
              factoryProjectId,
              { open: '1', started: '0', limit: UNSTARTED_LIMIT },
              signal,
            )
          ).workItems
      : skipToken,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * {@link unstartedWorkItemsQueryOptions} with the lean sync laid over them: a card that starts a session
 * or closes leaves, a newly filed one joins.
 */
export function useUnstartedWorkItems(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const changes = useBoardChangesQuery(factoryProjectId);
  const found = useQuery(unstartedWorkItemsQueryOptions(baseUrl, factoryProjectId));
  const data = useMemo(() => {
    if (!found.data || !changes.data) return found.data;
    const merged = mergeCards(found.data, changes.data.workItems, new Set(changes.data.deletedIds));
    return merged.filter(card => Object.keys(card.sessions).length === 0 && !card.stages.some(isTerminalStage));
  }, [found.data, changes.data]);
  return { data, isLoading: found.isLoading, isError: found.isError, refetch: found.refetch };
}

/** Sessions parked on a plan or a question, read with the board's lean sync so every route shares one poll. */
export function useParkedSessions(factoryProjectId: string | undefined): ReadonlySet<string> {
  const { baseUrl } = useApiConfig();
  const { data } = useQuery({ ...boardChangesQueryOptions(baseUrl, factoryProjectId), select: selectParkedSessions });
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
      const previous = snapshotBoards(queryClient, listKey);
      if (patch.parentWorkItemId !== undefined) {
        patchCards(queryClient, listKey, cards =>
          cards.map(item => (item.id === id ? { ...item, parentWorkItemId: patch.parentWorkItemId ?? null } : item)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => restoreBoards(queryClient, context?.previous),
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
      const previousItem = cachedCard(queryClient, listKey, item.id);
      const enteredAt = new Date().toISOString();
      const actor = currentUserId ?? 'factory:optimistic';
      // A card read from a column page is not in the snapshot yet; adding it lets the move show at once,
      // and the snapshot copy wins over the page one on a tie.
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
      const previous = snapshotBoards(queryClient, listKey);
      // Marked gone too, so readers laying the change feed over their own pages drop their copy.
      queryClient.setQueriesData<BoardSnapshot>({ queryKey: listKey }, board =>
        board
          ? {
              ...board,
              workItems: board.workItems.filter(item => item.id !== id),
              deletedIds: [...(board.deletedIds ?? []), id],
            }
          : undefined,
      );
      return { previous };
    },
    onError: (_err, _id, context) => restoreBoards(queryClient, context?.previous),
    onSuccess: () => {
      // patchCards keeps the snapshot's session markers, so refetch to drop the deleted card's with it.
      void queryClient.invalidateQueries({ queryKey: listKey });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItemColumnsRoot(factoryProjectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItemLookupRoot(factoryProjectId) });
    },
  });
}
