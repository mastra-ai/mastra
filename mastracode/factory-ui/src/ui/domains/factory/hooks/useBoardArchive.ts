import { skipToken, useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { getWorkItem, listWorkItemPage } from '../services/workItems';
import type { WorkItem, WorkItemPageSort } from '../services/workItems';

/** Cards per archive read: a screenful of a column, so the board never waits on a big page. */
export const BOARD_ARCHIVE_PAGE_SIZE = 50;

export interface ArchiveColumn {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
}

/**
 * Done and Canceled cards, which the board sync leaves out: one page per terminal column at first, the
 * next on scroll. Sort and search go to the server so a column shows the right cards before it has them
 * all; people, label and source filters still run over what is loaded. A deep-linked card outside the
 * loaded pages is read on its own.
 */
export function useBoardArchive({
  factoryProjectId,
  board,
  stages,
  sort,
  search,
  targetItemId,
  enabled,
}: {
  factoryProjectId: string | undefined;
  board: string;
  /** The board's terminal phases. */
  stages: readonly string[];
  sort: WorkItemPageSort;
  search: string;
  /** A card the URL points at, read by id when no loaded page has it. */
  targetItemId?: string;
  /** Off until the board has loaded, so the open cards land first. */
  enabled: boolean;
}) {
  const { baseUrl } = useApiConfig();
  const q = search.trim();
  const scope = `${board}\u0000${sort}\u0000${q}`;
  // Cursors of the pages each column asked for. A new sort or search starts every column over.
  const [cursors, setCursors] = useState<{ scope: string; byStage: Record<string, string[]> }>({ scope, byStage: {} });
  const byStage = cursors.scope === scope ? cursors.byStage : {};

  const reads = stages.flatMap(stage =>
    [undefined, ...(byStage[stage] ?? [])].map(cursor => ({ stage, cursor })),
  );
  const pages = useQueries({
    queries: reads.map(({ stage, cursor }) => ({
      queryKey: queryKeys.workItemArchive(factoryProjectId, board, stage, sort, q, cursor ?? null),
      queryFn: factoryProjectId
        ? ({ signal }: { signal: AbortSignal }) =>
            listWorkItemPage(
              baseUrl,
              factoryProjectId,
              { board, stage, sort, q, limit: BOARD_ARCHIVE_PAGE_SIZE, cursor },
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
    isPending: enabled && pages.pending,
  };
}
