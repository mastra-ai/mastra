import type { FactoryRuleStage } from '@mastra/factory/rules/types';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import {
  keepPreviousData,
  queryOptions,
  replaceEqualDeep,
  skipToken,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { cardMoveMutationKey, cardWriteMutationKey, isUnnarrowedBoardView, queryKeys } from '../api/keys';
import type { BoardPhasesRequest } from '../api/types';
import { activityDepth, activityStart } from '../ui/domains/factory/periodActivity';
import type { ActivityPeriod } from '../ui/domains/factory/periodActivity';
import { itemBoard } from '../ui/domains/factory/boardStages';
import {
  createWorkItem,
  deleteWorkItem,
  fetchWorkItemActivity,
  fetchBoardPhases,
  fetchWorkItemFilterOptions,
  fetchWorkItemStarters,
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
  WorkItemStageEntry,
} from '../ui/domains/factory/services/workItems';

function requireFactoryProjectId(factoryProjectId: string | undefined): string {
  if (!factoryProjectId) throw new Error('No Factory selected');
  return factoryProjectId;
}

/**
 * Rewrite the cached cards of the board and of every session read under `listKey`, keeping the
 * session activity read alongside them.
 */
function patchCards(queryClient: QueryClient, listKey: QueryKey, patch: (cards: WorkItem[]) => WorkItem[]) {
  // Returning undefined skips the write: never seed a partial board before the list query loads.
  queryClient.setQueriesData<BoardSnapshot>({ queryKey: listKey }, board =>
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

// Module-level so React Query can cache the derived value instead of rebuilding it per render.
const selectCards = (board: BoardSnapshot) => board.workItems;

/** The cards holding a session, with the cards related to them, and the sessions parked on them. */
export function sessionCardsQueryOptions(baseUrl: string, factoryProjectId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.workItemsWithSessions(factoryProjectId),
    queryFn: factoryProjectId
      ? ({ signal }) => listWorkItems(baseUrl, factoryProjectId, signal, { scope: 'sessions' })
      : skipToken,
    // The feed provider refreshes this. A hidden tab holds no stream and polls nothing, so refresh immediately on return.
    refetchOnWindowFocus: true,
  });
}

/** A phase of a board view: the cards it lists, in the view's order, of the `total` that match. */
export interface ListedPhase {
  phase: string;
  total: number;
  ids: string[];
}

/**
 * One view of a board as of one read: which cards each phase lists, how many match, and in
 * `workItems` the body of every listed card, of the asked card and of the cards related to them.
 */
export interface BoardPhasesSnapshot extends BoardSnapshot {
  phases: ListedPhase[];
  /**
   * The card the read asked for, and the phases of the view that hold it, listed there or deeper.
   * Absent when the board does not hold the card; in no phase when the view leaves it out.
   */
  asked?: { id: string; phases: string[] };
  /** How many of the board's cards match the view's search and filters. */
  matchingTotal: number;
  /** How many cards the board holds, whatever the view. */
  boardTotal: number;
}

/** The most ids one `workItemId` read may name. */
const CARDS_PER_READ = 100;

/** The cards among `ids` the server still holds, read by id. */
async function readCards(baseUrl: string, factoryProjectId: string, ids: string[], signal: AbortSignal) {
  const reads: Promise<BoardSnapshot>[] = [];
  for (let start = 0; start < ids.length; start += CARDS_PER_READ) {
    const workItemId = ids.slice(start, start + CARDS_PER_READ);
    reads.push(listWorkItems(baseUrl, factoryProjectId, signal, { workItemId }));
  }
  return (await Promise.all(reads)).flatMap(read => read.workItems);
}

/**
 * The card the tab holds for each id of `versions`, from whichever read cached it. Where several
 * reads hold a card, the one whose body is the version named wins.
 */
function heldCards(client: QueryClient, factoryProjectId: string, versions: ReadonlyMap<string, string>) {
  const held = new Map<string, WorkItem>();
  const snapshots = client.getQueriesData<BoardSnapshot>({ queryKey: queryKeys.workItems(factoryProjectId) });
  for (const [, snapshot] of snapshots) {
    for (const card of snapshot?.workItems ?? []) {
      const version = versions.get(card.id);
      if (version === undefined) continue;
      const holder = held.get(card.id);
      if (!holder || (card.version === version && holder.version !== version)) held.set(card.id, card);
    }
  }
  return held;
}

/**
 * Reads one view of a board. The server names the cards of each phase with the version of the
 * body it would send for each; only the cards the tab does not hold at that version are
 * downloaded, by id. The first read of a board holds none, so it asks for the bodies with the
 * listing. A card the read leaves equal stays the object held, so nothing showing it renders
 * again, and a read that changes nothing answers the snapshot held. `openCard` is asked for in
 * place of the card the view names: the answer says which phases hold it, however deep.
 */
async function readBoardPhases(
  baseUrl: string,
  factoryProjectId: string,
  request: BoardPhasesRequest,
  openCard: string | undefined,
  signal: AbortSignal,
  client: QueryClient,
): Promise<BoardPhasesSnapshot> {
  const boardHeld = client
    .getQueriesData<BoardPhasesSnapshot>({ queryKey: queryKeys.boardPhases(factoryProjectId, request.board) })
    .some(([, snapshot]) => snapshot !== undefined);
  const asked = openCard ? { ...request, item: openCard } : request;
  const answer = await fetchBoardPhases(baseUrl, factoryProjectId, asked, !boardHeld, signal);
  const named = [
    ...answer.phases.flatMap(phase => phase.cards),
    ...(answer.item ? [answer.item] : []),
    ...answer.related,
  ];
  const versions = new Map(named.map(card => [card.id, card.version]));
  const read = new Map(answer.workItems?.map(card => [card.id, card]));
  const heldAtAnswer = heldCards(client, factoryProjectId, versions);
  const stale = [...versions].flatMap(([id, version]) =>
    read.has(id) || heldAtAnswer.get(id)?.version === version ? [] : [id],
  );
  if (stale.length > 0) {
    for (const card of await readCards(baseUrl, factoryProjectId, stale, signal)) {
      if (versions.has(card.id)) read.set(card.id, card);
    }
  }
  // Read again: the cards held carry the changes made here while the server answered.
  const held = heldCards(client, factoryProjectId, versions);
  const cards = new Map<string, WorkItem>();
  // A card the server holds no body of was deleted since the listing: no phase shows it, and the
  // older body the tab holds is not it.
  const deleted = new Set(stale.filter(id => !read.has(id)));
  for (const id of versions.keys()) {
    if (deleted.has(id)) continue;
    const body = read.get(id);
    const card = body ? replaceEqualDeep(held.get(id), body) : held.get(id);
    if (card) cards.set(id, card);
  }
  const answered = answer.item;
  const listing = {
    phases: answer.phases.map(listed => ({
      phase: listed.phase,
      total: listed.total,
      ids: listed.cards.flatMap(({ id }) => (cards.has(id) ? [id] : [])),
    })),
    ...(answered && cards.has(answered.id)
      ? { asked: { id: answered.id, phases: answered.places.map(place => place.phase) } }
      : {}),
    matchingTotal: answer.matchingTotal,
    boardTotal: answer.boardTotal,
    runningSessionIds: answer.runningSessionIds,
    parkedSessionIds: answer.parkedSessionIds,
  };
  const workItems = [...cards.values()];
  const previous = client.getQueryData<BoardPhasesSnapshot>(queryKeys.boardPhasesView(factoryProjectId, request));
  if (!previous) return { ...listing, workItems };
  const { workItems: previousCards, ...previousListing } = previous;
  const sameCards =
    workItems.length === previousCards.length && workItems.every((card, i) => card === previousCards[i]);
  const sharedListing = replaceEqualDeep(previousListing, listing);
  if (sameCards && sharedListing === previousListing) return previous;
  return { ...sharedListing, workItems: sameCards ? previousCards : workItems };
}

/**
 * One view of a board: its phases, and the cards they list. `openCard` is the card whose details
 * the page holds open: every read asks for it, so a refresh or a new order never takes it off the
 * page, however deep its phase holds it. It stays out of the key, because the view is the same
 * with a card open: opening or closing one reads nothing.
 */
export function boardPhasesQueryOptions(
  baseUrl: string,
  factoryProjectId: string | undefined,
  request: BoardPhasesRequest,
  openCard?: string,
) {
  return queryOptions({
    queryKey: queryKeys.boardPhasesView(factoryProjectId, request),
    queryFn: factoryProjectId
      ? ({ signal, client }) => readBoardPhases(baseUrl, factoryProjectId, request, openCard, signal, client)
      : skipToken,
    // The feed provider refreshes this. A hidden tab holds no stream and polls nothing, so refresh immediately on return.
    refetchOnWindowFocus: true,
    // `readBoardPhases` shares cards by id. React Query shares by index, which would rebuild
    // every card after an added or removed one.
    structuralSharing: false,
  });
}

/** The labels and people the project's cards can be filtered by. */
export function workItemFilterOptionsQueryOptions(baseUrl: string, factoryProjectId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.workItemFilterOptions(factoryProjectId),
    queryFn: factoryProjectId
      ? ({ signal }) => fetchWorkItemFilterOptions(baseUrl, factoryProjectId, signal)
      : skipToken,
    // Refreshed with the board, by the feed provider and on return to a hidden tab.
    refetchOnWindowFocus: true,
  });
}

/** What the draft page's starter buttons count: the server counts, so the page never loads the board for them. */
export function workItemStartersQueryOptions(baseUrl: string, factoryProjectId: string) {
  return queryOptions({
    queryKey: queryKeys.workItemStarters(factoryProjectId),
    queryFn: ({ signal }) => fetchWorkItemStarters(baseUrl, factoryProjectId, signal),
    // Refreshed with the board, by the feed provider and on return to a hidden tab.
    refetchOnWindowFocus: true,
  });
}

const HOUR_MS = 60 * 60 * 1000;

/** When cards were created and completed over `period`, for the activity band. */
export function workItemActivityQueryOptions(baseUrl: string, factoryProjectId: string, period: ActivityPeriod) {
  const depth = activityDepth(period);
  return queryOptions({
    queryKey: queryKeys.workItemActivity(factoryProjectId, depth),
    queryFn: ({ signal }) => {
      // From the hour, so the address repeats and the browser can revalidate it; the band drops what falls before its own start.
      const since = Math.floor(activityStart(depth, Date.now()) / HOUR_MS) * HOUR_MS;
      return fetchWorkItemActivity(baseUrl, factoryProjectId, since, signal);
    },
    // Refreshed with the board, by the feed provider and on return to a hidden tab.
    refetchOnWindowFocus: true,
  });
}

/**
 * The cards holding one session, with the cards related to them: what a session page reads
 * instead of the board.
 */
export function useSessionWorkItemsQuery(factoryProjectId: string | undefined, sessionId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.sessionWorkItems(factoryProjectId, sessionId),
    queryFn:
      factoryProjectId && sessionId
        ? ({ signal }) => listWorkItems(baseUrl, factoryProjectId, signal, { sessionId })
        : skipToken,
    // Refreshed with the board, by the feed provider and on return to a hidden tab.
    refetchOnWindowFocus: true,
    select: selectCards,
  });
}

/** The cards the sidebar marks its sessions with: the ones holding a session, with the cards related to them. */
export function useSidebarWorkItemsQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery(sessionCardsQueryOptions(baseUrl, factoryProjectId));
}

/**
 * One view of a board. Changing the view keeps the phases shown until the new ones answer. A view
 * the tab read while `openCard` was closed may hold it below what its phases list: that read is
 * not shown over the open card. The view is read for the card instead, and the card stays on the
 * page until the answer says where it is.
 */
export function useBoardPhasesQuery(
  factoryProjectId: string | undefined,
  request: BoardPhasesRequest,
  openCard?: string,
) {
  const { baseUrl } = useApiConfig();
  const held = useQueryClient().getQueryData<BoardPhasesSnapshot>(queryKeys.boardPhasesView(factoryProjectId, request));
  const heldWithoutOpenCard = openCard !== undefined && held?.workItems.every(card => card.id !== openCard);
  return useQuery({
    ...boardPhasesQueryOptions(
      baseUrl,
      factoryProjectId,
      heldWithoutOpenCard ? { ...request, item: openCard } : request,
      openCard,
    ),
    placeholderData: keepPreviousData,
  });
}

/** The labels and people the board's filter menus offer. */
export function useWorkItemFilterOptionsQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery(workItemFilterOptionsQueryOptions(baseUrl, factoryProjectId));
}

/** The snapshot listing `item` on top of the phases it sits in, where it does not list it yet. */
function withCardOnTop(snapshot: BoardPhasesSnapshot, item: WorkItem): BoardPhasesSnapshot {
  if (snapshot.phases.some(listed => listed.ids.includes(item.id))) return snapshot;
  const sitsInAPhase = snapshot.phases.some(listed => item.stages.includes(listed.phase));
  return {
    ...snapshot,
    workItems: [item, ...snapshot.workItems.filter(card => card.id !== item.id)],
    // A card in no phase of its board shows in the first one, where cards start.
    phases: snapshot.phases.map((listed, index) =>
      (sitsInAPhase ? item.stages.includes(listed.phase) : index === 0)
        ? { ...listed, ids: [item.id, ...listed.ids], total: listed.total + 1 }
        : listed,
    ),
    matchingTotal: snapshot.matchingTotal + 1,
    boardTotal: snapshot.boardTotal + 1,
  };
}

/** The cached cards without the card `id`, which the phases that listed it no longer count. */
function withoutCard(cached: BoardSnapshot | BoardPhasesSnapshot, id: string): BoardSnapshot | BoardPhasesSnapshot {
  const workItems = cached.workItems.filter(card => card.id !== id);
  if (!('phases' in cached) || !cached.phases.some(listed => listed.ids.includes(id))) {
    return { ...cached, workItems };
  }
  return {
    ...cached,
    workItems,
    phases: cached.phases.map(listed =>
      listed.ids.includes(id)
        ? { ...listed, ids: listed.ids.filter(other => other !== id), total: listed.total - 1 }
        : listed,
    ),
    matchingTotal: cached.matchingTotal - 1,
    boardTotal: cached.boardTotal - 1,
  };
}

/** Whether a session is parked; `undefined` until the cards holding sessions have been read. */
export function useSessionParked(factoryProjectId: string | undefined, sessionId: string): boolean | undefined {
  const { data } = useSidebarWorkItemsQuery(factoryProjectId);
  return data?.parkedSessionIds.includes(sessionId);
}

/**
 * Materialize a work item (the server upserts on `sourceKey`, so acting twice
 * on the same issue reuses the card). The cached cards are patched in place.
 */
export function useUpsertWorkItemMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: cardWriteMutationKey(factoryProjectId),
    mutationFn: (input: CreateWorkItemInput) =>
      createWorkItem(baseUrl, requireFactoryProjectId(factoryProjectId), input),
    onSuccess: item => {
      // A session's cards take the saved card only where they hold it; a new card joins its board alone.
      patchCards(queryClient, queryKeys.workItems(factoryProjectId), cards =>
        cards.map(card => (card.id === item.id ? item : card)),
      );
      // Only the server knows whether a card matches a search or a filter: the view with neither
      // takes the card, and the server is asked for the others again.
      const boardKey = queryKeys.boardPhases(factoryProjectId, itemBoard(item));
      queryClient.setQueriesData<BoardPhasesSnapshot>(
        { queryKey: boardKey, predicate: query => isUnnarrowedBoardView(query.queryKey) },
        snapshot => snapshot && withCardOnTop(snapshot, item),
      );
      void queryClient.invalidateQueries({
        queryKey: boardKey,
        predicate: query => !isUnnarrowedBoardView(query.queryKey),
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
    mutationKey: cardWriteMutationKey(factoryProjectId),
    mutationFn: ({ id, patch }: { id: string; patch: UpdateWorkItemInput }) => updateWorkItem(baseUrl, id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueriesData<BoardSnapshot>({ queryKey: listKey });
      if (patch.parentWorkItemId !== undefined) {
        patchCards(queryClient, listKey, cards =>
          cards.map(item => (item.id === id ? { ...item, parentWorkItemId: patch.parentWorkItemId ?? null } : item)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      for (const [key, snapshot] of context?.previous ?? []) queryClient.setQueryData(key, snapshot);
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
  const mutationKey = cardMoveMutationKey(factoryProjectId);
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
      const enteredAt = new Date().toISOString();
      const actor = currentUserId ?? 'factory:optimistic';
      patchCards(queryClient, listKey, cards =>
        cards.map(candidate =>
          candidate.id === item.id
            ? {
                ...candidate,
                stages: [stage],
                stageHistory: optimisticStageHistory(candidate, stage, enteredAt, actor, reenter),
              }
            : candidate,
        ),
      );
      return { enteredAt, actor };
    },
    // The card the move was asked of is the one held before it: every read holds cards by revision.
    onError: (_error, variables) => {
      patchCards(queryClient, listKey, cards =>
        cards.map(item => {
          if (item.id !== variables.item.id || item.revision !== variables.item.revision) return item;
          return variables.item;
        }),
      );
    },
    onSuccess: async (result, variables, context) => {
      patchCards(queryClient, listKey, cards =>
        cards.map(item => {
          if (item.id !== variables.item.id || item.revision !== variables.item.revision) return item;
          if (result.status === 'rejected') return variables.item;
          if (result.revision <= item.revision) return item;
          const previousItem = variables.item;
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
            // The server changed more of the card than its stage: the next read downloads it whatever version it names.
            version: undefined,
          };
        }),
      );
    },
    // Landed or not, the board skipped its card reads while this was in flight, so it re-reads here.
    // The lane's rule queues its run inside this commit. Awaiting both refetches keeps the
    // move pending until the card shows that run, so its button never reappears in between.
    onSettled: async () => {
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
    mutationKey: cardWriteMutationKey(factoryProjectId),
    mutationFn: (id: string) => deleteWorkItem(baseUrl, id),
    onMutate: async id => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueriesData<BoardSnapshot>({ queryKey: listKey });
      queryClient.setQueriesData<BoardSnapshot | BoardPhasesSnapshot>(
        { queryKey: listKey },
        cached => cached && withoutCard(cached, id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      for (const [key, snapshot] of context?.previous ?? []) queryClient.setQueryData(key, snapshot);
    },
    onSuccess: () => {
      // patchCards keeps the snapshot's session markers, so refetch to drop the deleted card's with it.
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
}
