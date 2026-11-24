import { useCallback, useMemo } from 'react';

import type { ListSort, SortDirection } from './sort-by';

export const SORT_KEY_PARAM = 'sort';
export const SORT_DIR_PARAM = 'dir';
const PAGE_PARAM = 'page';

/** Minimal interface compatible with react-router's `setSearchParams`. */
export type SetURLSearchParamsLike = (
  next: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
  options?: { replace?: boolean; preventScrollReset?: boolean; state?: unknown },
) => void;

export interface UseUrlSortOptions<K extends string> {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParamsLike;
  allowedKeys: readonly K[];
  defaultSort?: ListSort<K>;
}

export function readUrlSort<K extends string>(
  searchParams: URLSearchParams,
  allowedKeys: readonly K[],
  defaultSort?: ListSort<K>,
): ListSort<K> {
  const key = searchParams.get(SORT_KEY_PARAM);
  if (!key || !allowedKeys.includes(key as K)) return defaultSort;

  const dir = searchParams.get(SORT_DIR_PARAM);
  const direction: SortDirection = dir === 'desc' ? 'desc' : 'asc';
  return { key: key as K, direction };
}

/**
 * Reads/writes `?sort=<key>&dir=asc|desc`. Unknown keys are ignored. Changing
 * the sort also drops `page` so paginated lists restart from the first page.
 */
export function useUrlSort<K extends string>({
  searchParams,
  setSearchParams,
  allowedKeys,
  defaultSort,
}: UseUrlSortOptions<K>) {
  const sortKey = searchParams.get(SORT_KEY_PARAM);
  const sortDir = searchParams.get(SORT_DIR_PARAM);

  const sort = useMemo(
    () => readUrlSort(searchParams, allowedKeys, defaultSort),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-read when the sort params change
    [sortKey, sortDir, allowedKeys, defaultSort],
  );

  const onSortChange = useCallback(
    (direction: SortDirection, key: string) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          next.set(SORT_KEY_PARAM, key);
          next.set(SORT_DIR_PARAM, direction);
          next.delete(PAGE_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { sort, onSortChange };
}
