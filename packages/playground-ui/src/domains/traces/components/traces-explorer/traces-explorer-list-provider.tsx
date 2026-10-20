import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTracesListSource } from '../../hooks/use-traces-list-source';
import { buildTracesLegacyFilters, buildTracesQueryRequest } from './traces-explorer-actions';
import type { TracesSortDirection } from './traces-explorer-actions';
import { TracesListContext, useTracesConfig, useTracesFilters } from './traces-explorer-context';
import type { TracesListContextValue } from './traces-explorer-context';

type TracesListProviderProps = {
  sortDirection: TracesSortDirection;
  onSortChange: (direction: TracesSortDirection) => void;
  children: ReactNode;
};

/**
 * Owns the list query and its poll clock. Its own memoized component so a poll tick re-renders
 * only list consumers, and a selection change doesn't re-run the list query hooks.
 */
export const TracesListProvider = memo(function TracesListProvider({
  sortDirection,
  onSortChange,
  children,
}: TracesListProviderProps) {
  const { withQueryTrace, withRootDuration, isCapabilitiesLoading } = useTracesConfig();
  const { filters, dateFrom, dateTo } = useTracesFilters();
  const list = useTracesListSource({
    rolling: !dateTo,
    query: now => buildTracesQueryRequest({ filters, dateFrom, dateTo, withRootDuration, now }),
    orderBy: [{ field: 'startedAt', direction: sortDirection }],
    withQueryTrace,
    enabled: !isCapabilitiesLoading,
    legacyFilters: buildTracesLegacyFilters({ filters, dateFrom, dateTo }),
  });

  const { rows, isLoading, isFetchingNextPage, hasNextPage, setEndOfListElement, error, autoRefetch, setAutoRefetch } =
    list;
  const value = useMemo<TracesListContextValue>(
    () => ({
      rows,
      isLoading,
      isFetchingNextPage,
      hasNextPage,
      setEndOfListElement,
      error,
      autoRefetch,
      setAutoRefetch,
      sortDirection,
      onSortChange,
    }),
    [
      rows,
      isLoading,
      isFetchingNextPage,
      hasNextPage,
      setEndOfListElement,
      error,
      autoRefetch,
      setAutoRefetch,
      sortDirection,
      onSortChange,
    ],
  );

  return <TracesListContext.Provider value={value}>{children}</TracesListContext.Provider>;
});
