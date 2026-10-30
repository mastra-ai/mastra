import { useDebouncedValue } from '@mastra/playground-ui/hooks/use-debounced-value';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useApiConfig } from '../../../../api/config';
import { useWorkItemsWithSessionCards } from '../../../../hooks/useWorkItems';
import { listWorkItemPage } from '../../factory/services/workItems';

export const GLOBAL_SEARCH_WORK_ITEM_LIMIT = 20;

/**
 * Cards for the palette: the board's, plus every card a session ran on so session results are titled.
 * A typed query also asks the server for matching cards, so Intake, Done and Canceled are reachable
 * without the palette ever reading every card.
 */
export function useGlobalSearchWorkItems(factoryId: string | undefined, search: string) {
  const { baseUrl } = useApiConfig();
  const query = useWorkItemsWithSessionCards(factoryId, true);
  const q = useDebouncedValue(search.trim(), 150);
  const matches = useQuery({
    queryKey: ['factory', 'work-item-search', factoryId ?? null, q],
    queryFn: ({ signal }) =>
      listWorkItemPage(baseUrl, factoryId!, { q, sort: 'relevance', limit: GLOBAL_SEARCH_WORK_ITEM_LIMIT }, signal),
    enabled: factoryId !== undefined && q !== '',
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  const items = useMemo(() => {
    const known = query.data ?? [];
    const found = q === '' ? undefined : matches.data?.workItems;
    if (!found) return known;
    const ids = new Set(known.map(item => item.id));
    return [...known, ...found.filter(item => !ids.has(item.id))];
  }, [query.data, matches.data, q]);

  return {
    items,
    refetch: query.refetch,
    pending: query.isLoading,
    failed: query.isError,
    retry: () => {
      void query.refetch();
    },
  };
}
