import { useDebouncedValue } from '@mastra/playground-ui/hooks/use-debounced-value';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useSessionWorkItems } from '../../../../hooks/useSessionWorkItems';
import { useExcludedCards } from '../../../../hooks/useWorkItems';
import { searchTerminalWorkItems } from '../../factory/services/workItems';

/** Shorter searches would match most closed cards. */
const MIN_CLOSED_SEARCH_LENGTH = 2;

/**
 * Board cards: they title the session results and are searchable on their own
 * before a session exists. The board snapshot leaves done and canceled cards
 * out, so the cards of listed sessions are looked up, and closed cards matching
 * the typed search are asked of the server.
 */
export function useGlobalSearchWorkItems(factoryId: string | undefined, sessionIds: readonly string[], search: string) {
  const { baseUrl } = useApiConfig();
  const board = useSessionWorkItems(factoryId, sessionIds);
  const excluded = useExcludedCards(factoryId);
  const query = useDebouncedValue(search.trim(), 300);
  const closed = useQuery({
    queryKey: queryKeys.terminalWorkItemSearch(factoryId, query),
    queryFn: ({ signal }) => searchTerminalWorkItems(baseUrl, factoryId!, query, signal),
    enabled: Boolean(factoryId) && query.length >= MIN_CLOSED_SEARCH_LENGTH,
    staleTime: 60_000,
  });

  const found = closed.data;
  const items = useMemo(() => {
    if (!found?.length) return board.items;
    const known = new Set(board.items.map(item => item.id));
    return [...board.items, ...found.filter(item => !known.has(item.id))];
  }, [board.items, found]);
  const excludedSourceKeys = useMemo(() => excluded.flatMap(group => group.sourceKeys), [excluded]);

  return {
    items,
    /** Keys of the closed cards the list leaves out, so Intake candidates for them stay hidden. */
    excludedSourceKeys,
    refetch: board.refetch,
    pending: board.isLoading,
    searching: closed.isFetching,
    failed: board.isError,
    retry: () => {
      void board.refetch();
    },
  };
}
