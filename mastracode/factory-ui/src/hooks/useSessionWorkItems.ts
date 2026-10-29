import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { lookupSessionWorkItems } from '../ui/domains/factory/services/workItems';
import type { WorkItem } from '../ui/domains/factory/services/workItems';
import { useWorkItemsQuery } from './useWorkItems';

const NO_ITEMS: WorkItem[] = [];
const NO_SESSIONS: string[] = [];

/**
 * The board's cards plus the cards of any listed session the board snapshot
 * left out — mostly done and canceled ones. Only the sessions missing from the
 * snapshot are looked up, once the snapshot has loaded; the lookup is not
 * polled, and refreshes when a transition invalidates the board or another
 * session goes missing.
 */
export function useSessionWorkItems(factoryProjectId: string | undefined, sessionIds: readonly string[]) {
  const { baseUrl } = useApiConfig();
  const board = useWorkItemsQuery(factoryProjectId);
  const boardItems = board.data;
  const missing = useMemo(() => {
    if (!boardItems) return NO_SESSIONS;
    const onBoard = new Set(boardItems.flatMap(item => Object.values(item.sessions).map(ref => ref.sessionId)));
    return [...new Set(sessionIds)].filter(sessionId => !onBoard.has(sessionId)).sort();
  }, [boardItems, sessionIds]);

  const lookup = useQuery({
    queryKey: queryKeys.sessionWorkItems(factoryProjectId, missing),
    queryFn: ({ signal }) => lookupSessionWorkItems(baseUrl, factoryProjectId!, missing, signal),
    enabled: Boolean(factoryProjectId) && missing.length > 0,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const lookedUp = lookup.data;
  const items = useMemo(() => {
    if (!boardItems) return NO_ITEMS;
    if (!lookedUp?.length) return boardItems;
    const onBoard = new Set(boardItems.map(item => item.id));
    return [...boardItems, ...lookedUp.filter(item => !onBoard.has(item.id))];
  }, [boardItems, lookedUp]);

  return {
    items,
    /** The board loaded and every missing session's card has been asked for. */
    isFetched: board.isFetched && (missing.length === 0 || lookedUp !== undefined || lookup.isError),
    isLoading: board.isLoading || (missing.length > 0 && lookup.isLoading),
    isError: board.isError,
    refetch: board.refetch,
  };
}
