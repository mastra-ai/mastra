import { keepPreviousData, skipToken, useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { mergeCards, useBoardChangesQuery } from '../../../../hooks/useWorkItems';
import { belongsToBoard } from '../boardStages';
import { countWorkItems, getWorkItem, listWorkItemPage } from '../services/workItems';
import type { WorkItem, WorkItemFilterQuery, WorkItemPageSort } from '../services/workItems';

/** Cards per column read: a screenful of a column, so the board never waits on a big page. */
export const BOARD_COLUMN_PAGE_SIZE = 50;

export interface BoardColumn {
  /** Whether the column has asked for its first page. */
  opened: boolean;
  open: () => void;
  /** Its first page is still on the way. */
  isPending: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
  /** Cards the server holds in this column under the board's filters and search. */
  serverCount: number | undefined;
}

/**
 * The board's cards, a page per column at a time. Filters, search and sort go to the server, so a column
 * shows the right first page and its header the right count before the column is loaded. Open columns
 * read at once; `deferred` ones (Done, Canceled) once first on screen. The lean board sync is laid over
 * the pages, so a card written since its page was read shows its latest copy, a new card shows at once
 * and a deleted one leaves. A deep-linked card outside the loaded pages is read on its own.
 */
export function useBoardColumns({
  factoryProjectId,
  board,
  stages,
  deferred,
  sort,
  search,
  filters,
  targetItemId,
  openItemId,
}: {
  factoryProjectId: string | undefined;
  board: string;
  /** Every phase of the board, in order. */
  stages: readonly string[];
  /** Phases that read nothing until they are first on screen. */
  deferred: ReadonlySet<string>;
  sort: WorkItemPageSort;
  search: string;
  /** People unfolded, so the server matches every id a pick stands for. */
  filters: WorkItemFilterQuery;
  /** A card the URL points at, read by id when no loaded page has it. */
  targetItemId?: string;
  /** The card whose details are open: kept on the board while open, even once no loaded page has it. */
  openItemId?: string;
}) {
  const { baseUrl } = useApiConfig();
  const changes = useBoardChangesQuery(factoryProjectId);
  const q = search.trim();
  const narrowing = { ...filters, ...(q ? { q } : {}) };
  const narrowingKey = JSON.stringify(Object.entries(narrowing).sort(([a], [b]) => a.localeCompare(b)));
  const narrowed = narrowingKey !== '[]';
  const scope = `${board}\u0000${sort}\u0000${narrowingKey}`;
  // Cursors of the pages each column asked for. A new sort, search or filter starts every column over.
  const [cursors, setCursors] = useState<{ scope: string; byStage: Record<string, string[]> }>({ scope, byStage: {} });
  const byStage = cursors.scope === scope ? cursors.byStage : {};
  // Kept across sort, search and filters: a column on screen stays on screen, and its observer will not say so again.
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const opened = (stage: string) => !deferred.has(stage) || seen.has(stage);

  const reads = stages
    .filter(opened)
    .flatMap(stage => [undefined, ...(byStage[stage] ?? [])].map(cursor => ({ stage, cursor })));
  const pages = useQueries({
    queries: reads.map(({ stage, cursor }) => ({
      queryKey: queryKeys.workItemColumn(factoryProjectId, board, stage, sort, narrowingKey, cursor ?? null),
      queryFn: factoryProjectId
        ? ({ signal }: { signal: AbortSignal }) =>
            listWorkItemPage(
              baseUrl,
              factoryProjectId,
              // Related cards ride along so a card can link its parent, children and PRs on the other board.
              { ...narrowing, board, stage, sort, limit: BOARD_COLUMN_PAGE_SIZE, cursor, related: '1' },
              signal,
            )
        : skipToken,
      // Edits reach the pages through the lean sync; a page only reads again on a resync.
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      placeholderData: cursor === undefined ? keepPreviousData : undefined,
    })),
    combine: results => ({
      data: results.map(result => result.data),
      fetching: results.map(result => result.isFetching),
      pending: results.map(result => result.isPending),
      error: results.find(result => result.error)?.error ?? undefined,
    }),
  });

  // Unfiltered counts ride the lean sync; filtered ones are read again whenever the sync moves.
  const filteredCounts = useQuery({
    queryKey: [...queryKeys.workItemColumnCounts(factoryProjectId, narrowingKey), changes.data?.cursor ?? null],
    queryFn:
      factoryProjectId && narrowed
        ? ({ signal }) => countWorkItems(baseUrl, factoryProjectId, { ...narrowing, board }, signal)
        : skipToken,
    enabled: narrowed && changes.isSuccess,
    placeholderData: keepPreviousData,
  });
  const counts = narrowed ? filteredCounts.data?.boards[board] : changes.data?.counts?.boards[board];

  const loaded = useMemo(() => pages.data.flatMap(page => page?.workItems ?? []), [pages.data]);
  const loadedIds = new Set(loaded.map(item => item.id));
  const target = useQuery({
    queryKey: [...queryKeys.workItemColumnsRoot(factoryProjectId), 'card', targetItemId ?? null],
    queryFn:
      factoryProjectId && targetItemId
        ? ({ signal }) => getWorkItem(baseUrl, factoryProjectId, targetItemId, signal)
        : skipToken,
    enabled: targetItemId !== undefined && !loadedIds.has(targetItemId),
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Every card read since the board opened, latest copy first: people and label pickers offer these, so
  // narrowing the board never takes the other choices out of the picker.
  const seenRef = useRef<{ scope: string; cards: Map<string, WorkItem> }>({ scope: '', cards: new Map() });
  const seenScope = `${factoryProjectId ?? ''}\u0000${board}`;
  if (seenRef.current.scope !== seenScope) seenRef.current = { scope: seenScope, cards: new Map() };

  const openCard = openItemId === undefined ? undefined : seenRef.current.cards.get(openItemId);
  const items: WorkItem[] = useMemo(() => {
    const read = [...(openCard ? [openCard] : []), ...loaded, ...(target.data ? [target.data] : [])];
    if (!changes.data) return mergeCards([], read);
    const changed = changes.data.workItems.filter(card => belongsToBoard(card, board));
    return mergeCards(read, changed, new Set(changes.data.deletedIds));
  }, [openCard, loaded, target.data, changes.data, board]);

  const known = useMemo(() => {
    const cards = seenRef.current.cards;
    for (const item of items) cards.set(item.id, item);
    for (const id of changes.data?.deletedIds ?? []) cards.delete(id);
    return [...cards.values()];
  }, [items, seenScope, changes.data?.deletedIds]);

  const columns: Record<string, BoardColumn> = {};
  for (const stage of stages) {
    const indexes = reads.flatMap((read, index) => (read.stage === stage ? [index] : []));
    const lastIndex = indexes.at(-1);
    const nextCursor = lastIndex === undefined ? undefined : pages.data[lastIndex]?.nextCursor;
    const fetching = indexes.some(index => pages.fetching[index]);
    columns[stage] = {
      opened: opened(stage),
      open: () => setSeen(current => (current.has(stage) ? current : new Set([...current, stage]))),
      isPending: indexes[0] !== undefined && pages.pending[indexes[0]] === true,
      hasNextPage: nextCursor !== undefined,
      isFetchingNextPage: fetching,
      loadMore: () => {
        if (!nextCursor || fetching) return;
        setCursors(current => {
          const base = current.scope === scope ? current.byStage : {};
          const known = base[stage] ?? [];
          if (known.includes(nextCursor)) return current;
          return { scope, byStage: { ...base, [stage]: [...known, nextCursor] } };
        });
      },
      serverCount: counts?.[stage],
    };
  }

  return {
    items,
    known,
    columns,
    // The board waits on its open columns' first pages; Done and Canceled skeleton on their own.
    isPending:
      changes.isPending ||
      reads.some((read, index) => read.cursor === undefined && !deferred.has(read.stage) && pages.pending[index]),
    error: changes.error ?? pages.error,
    refetch: changes.refetch,
  };
}
