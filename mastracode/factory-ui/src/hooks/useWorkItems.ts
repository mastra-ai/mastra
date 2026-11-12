import type { FactoryRuleStage } from '@mastra/factory/rules/types';
import { boardCheck } from '@mastra/factory/work-items/board-check';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import {
  queryOptions,
  replaceEqualDeep,
  skipToken,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { cardMoveMutationKey, cardWriteMutationKey, queryKeys } from '../api/keys';
import { dropIntakeCandidate } from './useIntakeCandidates';
import { activityDepth, activityStart } from '../ui/domains/factory/periodActivity';
import type { ActivityPeriod } from '../ui/domains/factory/periodActivity';
import {
  createWorkItem,
  deleteWorkItem,
  fetchWorkItemActivity,
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

// Module-level so React Query can cache each derived value instead of
// rebuilding it (and, for the set, breaking referential equality) per render.
const selectCards = (board: BoardSnapshot) => board.workItems;
const selectParkedSessions = (board: BoardSnapshot): ReadonlySet<string> => new Set(board.parkedSessionIds);
const NO_SESSIONS: ReadonlySet<string> = new Set();

/**
 * Reads the board: whole the first time, then only what moved since the cursor of the board
 * held, merged into the board held when the answer arrives. That board carries the changes
 * made here that the server has not answered and none it refused. A card the answer leaves
 * equal stays the object held, so nothing showing it renders again.
 */
async function readBoard(
  baseUrl: string,
  factoryProjectId: string,
  signal: AbortSignal,
  client: QueryClient,
  whole = false,
): Promise<BoardSnapshot> {
  const held = () => client.getQueryData<BoardSnapshot>(queryKeys.workItems(factoryProjectId));
  const since = whole ? undefined : held()?.cursor;
  const only = since ? { since } : undefined;
  const { removedIds, check, ...read } = await listWorkItems(baseUrl, factoryProjectId, signal, only);
  const board = held();
  const byId = new Map(board?.workItems.map(card => [card.id, card]));
  let cards = read.workItems.map(card => replaceEqualDeep(byId.get(card.id), card));
  if (removedIds) {
    for (const card of cards) byId.set(card.id, card);
    for (const id of removedIds) byId.delete(id);
    cards = [...byId.values()];
    // What moved fits only the board its cursor names, and leaves the board the server checks
    // once every card written here is answered. Otherwise this copy drifted: read it whole.
    const writing = client.isMutating({ mutationKey: cardWriteMutationKey(factoryProjectId) });
    if (board?.cursor !== since || (check !== boardCheck(cards) && !writing)) {
      return readBoard(baseUrl, factoryProjectId, signal, client, true);
    }
    // The order a whole read lists them in: newest first, then by id.
    cards.sort((a, b) => (a.createdAt + a.id < b.createdAt + b.id ? 1 : -1));
  }
  if (!board) return { ...read, workItems: cards };
  const same = cards.length === board.workItems.length && cards.every((card, i) => card === board.workItems[i]);
  return same ? replaceEqualDeep(board, { ...read, workItems: board.workItems }) : { ...read, workItems: cards };
}

/**
 * The board: its cards and the sessions parked on them. `scope` narrows it to the cards holding a
 * session, with the cards related to them.
 */
export function boardQueryOptions(baseUrl: string, factoryProjectId: string | undefined, scope?: 'sessions') {
  return queryOptions({
    queryKey: scope ? queryKeys.workItemsWithSessions(factoryProjectId) : queryKeys.workItems(factoryProjectId),
    queryFn: factoryProjectId
      ? ({ signal, client }) =>
          scope
            ? listWorkItems(baseUrl, factoryProjectId, signal, { scope })
            : readBoard(baseUrl, factoryProjectId, signal, client)
      : skipToken,
    // The feed provider refreshes this. A hidden tab holds no stream and polls nothing, so refresh immediately on return.
    refetchOnWindowFocus: true,
    // `readBoard` shares cards by id. React Query shares by index, which would rebuild every card
    // after an added or removed one.
    structuralSharing: !!scope,
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

/** The org's persisted work items (kanban cards) for a project. */
export function useWorkItemsQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({ ...boardQueryOptions(baseUrl, factoryProjectId), select: selectCards });
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

/**
 * The cards the sidebar marks its sessions with. A page that loads the board shares that read;
 * any other asks only for the cards holding a session.
 */
export function useSidebarWorkItemsQuery(factoryProjectId: string | undefined, boardOnPage: boolean) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const board = boardQueryOptions(baseUrl, factoryProjectId);
  const withSessions = boardQueryOptions(baseUrl, factoryProjectId, 'sessions');
  return useQuery({
    ...(boardOnPage ? board : withSessions),
    // Moving between the two keeps the other list's marks until this one answers.
    placeholderData: () => queryClient.getQueryData((boardOnPage ? withSessions : board).queryKey),
  });
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
    mutationKey: cardWriteMutationKey(factoryProjectId),
    mutationFn: (input: CreateWorkItemInput) =>
      createWorkItem(baseUrl, requireFactoryProjectId(factoryProjectId), input),
    onSuccess: (item, input) => {
      const boardKey = queryKeys.workItems(factoryProjectId);
      // A session's cards take the saved card only where they hold it; a new card joins the board alone.
      patchCards(queryClient, boardKey, cards => cards.map(card => (card.id === item.id ? item : card)));
      queryClient.setQueryData<BoardSnapshot>(boardKey, board =>
        board ? { ...board, workItems: [item, ...board.workItems.filter(card => card.id !== item.id)] } : undefined,
      );
      // The record that was filed, not the card that came back: an older card may answer under its own key.
      dropIntakeCandidate(queryClient, factoryProjectId, input);
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
      const previousItem = queryClient
        .getQueryData<BoardSnapshot>(listKey)
        ?.workItems.find(candidate => candidate.id === item.id);
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
      patchCards(queryClient, listKey, cards => cards.filter(item => item.id !== id));
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
