import type { BoardPhasesRequest } from '@mastra/client-js';

/**
 * Query keys of Factory's board. Hosts invalidate these from their feed, so their shape is part
 * of the hooks' contract: the board's card reads all sit under `workItems`, and the counts the
 * board shows sit outside it, so a rewrite of the cached cards never reaches them.
 */
export const factoryKeys = {
  workItems: (factoryProjectId: string | undefined) => ['factory', 'work-items', factoryProjectId ?? null] as const,
  // Under the board's key: whatever refreshes or rewrites the board's cards reaches these too.
  sessionWorkItems: (factoryProjectId: string | undefined, sessionId: string | undefined) =>
    [...factoryKeys.workItems(factoryProjectId), 'session', sessionId ?? null] as const,
  workItem: (factoryProjectId: string | undefined, workItemId: string | undefined) =>
    [...factoryKeys.workItems(factoryProjectId), 'card', workItemId ?? null] as const,
  workItemsWithSessions: (factoryProjectId: string | undefined) =>
    [...factoryKeys.workItems(factoryProjectId), 'sessions'] as const,
  /** Every view of one board the tab holds. */
  boardPhases: (factoryProjectId: string | undefined, board: string) =>
    [...factoryKeys.workItems(factoryProjectId), 'phases', board] as const,
  /** One view of a board; `windows` is how deep each of its phases is listed. */
  boardPhasesView: (factoryProjectId: string | undefined, { board, windows, ...view }: BoardPhasesRequest) =>
    [...factoryKeys.boardPhases(factoryProjectId, board), view, windows] as const,
  // Outside the board's key: these hold counts and dates, not cards.
  boardFacts: (factoryProjectId: string | undefined) => ['factory', 'board-facts', factoryProjectId ?? null] as const,
  workItemStarters: (factoryProjectId: string | undefined) =>
    [...factoryKeys.boardFacts(factoryProjectId), 'starters'] as const,
  workItemActivity: (factoryProjectId: string | undefined, depth: string) =>
    [...factoryKeys.boardFacts(factoryProjectId), 'activity', depth] as const,
  workItemFilterOptions: (factoryProjectId: string | undefined) =>
    [...factoryKeys.boardFacts(factoryProjectId), 'filter-options'] as const,
  /** Every decision list for a project, whatever status filter it was fetched with. */
  decisionsRoot: (factoryProjectId: string | undefined) => ['factory', 'decisions', factoryProjectId ?? null] as const,
  decisions: (factoryProjectId: string | undefined, statusKey: string) =>
    [...factoryKeys.decisionsRoot(factoryProjectId), statusKey] as const,
  /** Under the decision lists, so whatever refreshes them refreshes the queue too. */
  runQueue: (factoryProjectId: string | undefined) =>
    [...factoryKeys.decisionsRoot(factoryProjectId), 'run-queue'] as const,
  // Outside `workItems`: a rewrite of the cached cards must not reach these, which hold no card.
  sessionRowsRoot: (factoryProjectId: string | undefined) =>
    ['factory', 'session-rows', factoryProjectId ?? null] as const,
  cardWrite: (factoryProjectId: string | undefined) => ['factory', 'write-work-item', factoryProjectId] as const,
  cardMove: (factoryProjectId: string | undefined) =>
    [...factoryKeys.cardWrite(factoryProjectId), 'transition'] as const,
};

/** Whether a `boardPhasesView` key is the view with no search and no filter, which a new card joins without asking the server. */
export function isUnnarrowedBoardView(boardPhasesViewKey: readonly unknown[]): boolean {
  const view = boardPhasesViewKey.at(-2);
  if (typeof view !== 'object' || view === null || !('q' in view) || !('filters' in view)) return false;
  const { q, filters } = view;
  return q === '' && typeof filters === 'object' && filters !== null && Object.keys(filters).length === 0;
}
