import type { TraceIntelligenceEntitySort, TraceIntelligenceEntityView } from '@mastra/playground-ui/ee/signals';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

const SORTS = new Set<TraceIntelligenceEntitySort>(['default', 'entity-asc', 'entity-desc']);
const VIEWS = new Set<TraceIntelligenceEntityView>(['list', 'compact']);

export function useEntityIndexUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const sortParam = searchParams.get('sort') as TraceIntelligenceEntitySort | null;
  const viewParam = searchParams.get('view') as TraceIntelligenceEntityView | null;
  const sort = sortParam && SORTS.has(sortParam) ? sortParam : 'default';
  const view = viewParam && VIEWS.has(viewParam) ? viewParam : 'list';

  const update = useCallback(
    (key: 'search' | 'sort' | 'view', value: string, defaultValue: string) => {
      setSearchParams(
        current => {
          const next = new URLSearchParams(current);
          if (!value || value === defaultValue) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return {
    search,
    sort,
    view,
    onSearchChange: useCallback((value: string) => update('search', value, ''), [update]),
    onSortChange: useCallback((value: TraceIntelligenceEntitySort) => update('sort', value, 'default'), [update]),
    onViewChange: useCallback((value: TraceIntelligenceEntityView) => update('view', value, 'list'), [update]),
  };
}
