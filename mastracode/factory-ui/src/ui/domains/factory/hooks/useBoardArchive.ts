import { skipToken, useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { countWorkItems, getWorkItem, listWorkItemPage } from '../services/workItems';
import type { WorkItem, WorkItemPageSort } from '../services/workItems';

/** Cards per archive read: a screenful of a column, so the board never waits on a big page. */
export const BOARD_ARCHIVE_PAGE_SIZE = 50;

export interface ArchiveColumn {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
}

/**
 * Cards of the resting and closed columns (Intake, Done, Canceled), which the board sync leaves out:
 * one page per column at first, the next on scroll. Sort, search and filters go to the server, so a
 * column shows the right cards and the right count before it has them all. A deep-linked card outside
 * the loaded pages is read on its own.
 */
export function useBoardArchive({
  factoryProjectId,
  board,
  stages,
  sort,
  search,
  filters,
  targetItemId,
  enabled,
}: {
  factoryProjectId: string | undefined;
  board: string;
  /** The board's paged phases. */
  stages: readonly string[];
  sort: WorkItemPageSort;
  search: string;
  /** Board filters as query parameters (see `boardFilterQuery`). */
  filters: Readonly<Record<string, string>>;
  /** A card the URL points at, read by id when no loaded page has it. */
  targetItemId?: string;
  /** Off until the board has loaded, so the open cards land first. */
  enabled: boolean;
}) {
  const { baseUrl } = useApiConfig();
  const q = search.trim();
  const filterKey = new URLSearchParams(filters).toString();
  const scope = `${board}\u0000${sort}\u0000${q}\u0000${filterKey}`;
  // Cursors of the pages each column asked for. A new sort, search or filter starts every column over.
  const [cursors, setCursors] = useState<{ scope: string; byStage: Record<string, string[]> }>({ scope, byStage: {} });
  const byStage = cursors.scope === scope ? cursors.byStage : {};

  const reads = stages.flatMap(stage => [undefined, ...(byStage[stage] ?? [])].map(cursor => ({ stage, cursor })));
  const pages = useQueries({
    queries: reads.map(({ stage, cursor }) => ({
      queryKey: queryKeys.workItemArchive(factoryProjectId, board, stage, sort, q, filterKey, cursor ?? null),
      queryFn: factoryProjectId
        ? ({ signal }: { signal: AbortSignal }) =>
            listWorkItemPage(
              baseUrl,
              factoryProjectId,
              { board, stage, sort, q, limit: BOARD_ARCHIVE_PAGE_SIZE, cursor, filters },
              signal,
            )
        : skipToken,
      enabled,
      // A card closing reaches the board through its sync; the archive only has to catch up on a resync.
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    })),
    combine: results => ({
      data: results.map(result => result.data),
      fetching: results.map(result => result.isFetching),
      pending: results.some(result => result.isPending),
    }),
  });

  const loaded = useMemo(() => pages.data.flatMap(page => page?.workItems ?? []), [pages.data]);
  const loadedIds = new Set(loaded.map(item => item.id));
  const target = useQuery({
    queryKey: [...queryKeys.workItemArchiveRoot(factoryProjectId), 'card', targetItemId ?? null],
    queryFn:
      factoryProjectId && targetItemId
        ? ({ signal }) => getWorkItem(baseUrl, factoryProjectId, targetItemId, signal)
        : skipToken,
    enabled: enabled && targetItemId !== undefined && !loadedIds.has(targetItemId),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const items: WorkItem[] = useMemo(() => {
    const seen = new Set<string>();
    return [...loaded, ...(target.data ? [target.data] : [])].filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [loaded, target.data]);

  // Unfiltered counts ride the board sync; a filtered board asks the server what each column holds.
  const narrowed = q !== '' || filterKey !== '';
  const counts = useQuery({
    queryKey: [...queryKeys.workItemArchiveRoot(factoryProjectId), 'counts', board, q, filterKey],
    queryFn:
      factoryProjectId && narrowed
        ? ({ signal }) => countWorkItems(baseUrl, factoryProjectId, { ...filters, board, ...(q ? { q } : {}) }, signal)
        : skipToken,
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const columns: Record<string, ArchiveColumn> = {};
  for (const stage of stages) {
    const indexes = reads.flatMap((read, index) => (read.stage === stage ? [index] : []));
    const lastIndex = indexes.at(-1);
    const nextCursor = lastIndex === undefined ? undefined : pages.data[lastIndex]?.nextCursor;
    const fetching = indexes.some(index => pages.fetching[index]);
    columns[stage] = {
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
    };
  }

  return {
    items,
    columns,
    /** Per-column totals under the current search and filters; undefined when nothing narrows the board. */
    filteredCounts: narrowed ? counts.data?.boards[board] : undefined,
    isPending: enabled && pages.pending,
  };
}
