import { useCallback, useMemo } from 'react';

const TAB_PARAM = 'tab';
const VERSION_PARAM = 'version';

const TAB_VALUES = new Set(['items', 'experiments', 'review'] as const);
export type DatasetTab = 'items' | 'experiments' | 'review';

export type SetURLSearchParamsLike = (
  next: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
  options?: { replace?: boolean; preventScrollReset?: boolean; state?: unknown },
) => void;

export interface UseDatasetItemsUrlStateResult {
  tab: DatasetTab;
  activeVersion: number | null;

  handleTabChange: (tab: DatasetTab) => void;
  handleVersionChange: (version: number | null) => void;
}

/**
 * URL-derived state for the dataset detail view. Owns the `tab` and `version`
 * search params plus the handlers that mutate them.
 * Router-agnostic — pass `searchParams` and `setSearchParams` from the host router.
 *
 * `version` persists across tabs to match the prior in-memory behavior.
 */
export function useDatasetItemsUrlState(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParamsLike,
): UseDatasetItemsUrlStateResult {
  const tab = useMemo<DatasetTab>(() => {
    const value = searchParams.get(TAB_PARAM);
    return value && TAB_VALUES.has(value as DatasetTab) ? (value as DatasetTab) : 'items';
  }, [searchParams]);

  const activeVersion = useMemo<number | null>(() => {
    const value = searchParams.get(VERSION_PARAM);
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  const handleTabChange = useCallback(
    (next: DatasetTab) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          if (next === 'items') {
            params.delete(TAB_PARAM);
          } else {
            params.set(TAB_PARAM, next);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleVersionChange = useCallback(
    (next: number | null) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          if (next == null) {
            params.delete(VERSION_PARAM);
          } else {
            params.set(VERSION_PARAM, String(next));
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return {
    tab,
    activeVersion,
    handleTabChange,
    handleVersionChange,
  };
}
