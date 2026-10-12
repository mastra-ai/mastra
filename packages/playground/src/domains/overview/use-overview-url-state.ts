import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { useUrlSort } from '@mastra/playground-ui/sort/use-url-sort';
import { useSearchParams } from 'react-router';
import { isOverviewRange } from './overview-period';
import type { OverviewRange } from './overview-period';

const RANGE_PARAM = 'range';
const SEARCH_PARAM = 'q';
const DEFAULT_RANGE: OverviewRange = '24h';

export function useOverviewUrlState<K extends string>({
  sortKeys,
  defaultSort,
}: {
  sortKeys: readonly K[];
  defaultSort: ListSort<K>;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { sort, onSortChange } = useUrlSort({ searchParams, setSearchParams, allowedKeys: sortKeys, defaultSort });
  const rangeParam = searchParams.get(RANGE_PARAM);
  const range = isOverviewRange(rangeParam) ? rangeParam : DEFAULT_RANGE;
  const search = searchParams.get(SEARCH_PARAM) ?? '';

  const setParam = (name: string, value: string, { replace }: { replace: boolean }) =>
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace },
    );

  return {
    range,
    onRangeChange: (next: OverviewRange) =>
      setParam(RANGE_PARAM, next === DEFAULT_RANGE ? '' : next, { replace: false }),
    search,
    onSearchChange: (next: string) => setParam(SEARCH_PARAM, next, { replace: true }),
    sort,
    onSortChange,
  };
}
