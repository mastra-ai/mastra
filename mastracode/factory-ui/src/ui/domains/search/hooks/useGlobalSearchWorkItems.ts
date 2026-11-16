import { useDebouncedValue } from '@mastra/playground-ui/hooks/use-debounced-value';
import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useSidebarWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { listWorkItems } from '../../factory/services/workItems';
import type { BoardSnapshot, WorkItem } from '../../factory/services/workItems';

const NO_CARDS: WorkItem[] = [];

function selectUnstarted(board: BoardSnapshot) {
  // A server from before `started=false` ignores it and sends the whole board: keep what was asked for.
  const cards = board.workItems.filter(item => Object.keys(item.sessions).length === 0);
  // Such a server sends no count either: count what it sent.
  return { cards, total: board.total ?? cards.length };
}

/** The server's best unstarted cards for one search text, without the board. */
function useUnstartedSearch(factoryId: string | undefined, search: string) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    // Under the board key: whatever refreshes the board's cards refreshes these.
    queryKey: queryKeys.unstartedWorkItems(factoryId, search),
    queryFn: factoryId
      ? ({ signal }) => listWorkItems(baseUrl, factoryId, signal, { started: 'false', q: search })
      : skipToken,
    select: selectUnstarted,
    // Results stay up between searches instead of emptying while the next ones load.
    placeholderData: keepPreviousData,
  });
}

/**
 * Board cards for the palette, read in parts so opening it never downloads the board. The cards
 * holding a session title the session results. The cards holding none are searched by the server,
 * once typing pauses. Only cards are listed: the server files new issues and pull requests as cards,
 * so no provider is asked for its list.
 */
export function useGlobalSearchWorkItems(factoryId: string | undefined, typed: string) {
  const sessionCards = useSidebarWorkItemsQuery(factoryId);
  const withSessions = sessionCards.data?.workItems ?? NO_CARDS;
  const settled = useDebouncedValue(typed.trim(), 150);
  // Clearing the box goes back to the cached empty search at once.
  const search = useUnstartedSearch(factoryId, typed.trim() === '' ? '' : settled);
  // The rail counts the empty search, so its number holds still while typing narrows the rows.
  const everything = useUnstartedSearch(factoryId, '');
  const unstarted = search.data?.cards ?? NO_CARDS;

  // Kept across renders that load nothing new, so what is derived from it downstream is too.
  const loaded = useMemo(() => [...withSessions, ...unstarted], [withSessions, unstarted]);

  return {
    withSessions,
    unstarted,
    /** Every card either read loaded, for acting on a row. */
    loaded,
    count: everything.data?.total ?? 0,
    pending: sessionCards.isLoading || search.isLoading,
    failed: sessionCards.isError || search.isError,
    retry: () => {
      for (const query of [sessionCards, search]) {
        if (query.isError) void query.refetch();
      }
    },
  };
}
