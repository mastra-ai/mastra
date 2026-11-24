import { useCallback, useMemo } from 'react';

const VERSION_PARAM = 'version';

export type SetURLSearchParamsLike = (
  next: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
  options?: { replace?: boolean; preventScrollReset?: boolean; state?: unknown },
) => void;

export interface UseDatasetItemsUrlStateResult {
  activeVersion: number | null;
  handleVersionChange: (version: number | null) => void;
}

/**
 * URL-derived state for the dataset detail view. Owns the `version` search
 * param plus the handler that mutates it.
 * Router-agnostic — pass `searchParams` and `setSearchParams` from the host router.
 */
export function useDatasetItemsUrlState(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParamsLike,
): UseDatasetItemsUrlStateResult {
  const activeVersion = useMemo<number | null>(() => {
    const value = searchParams.get(VERSION_PARAM);
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

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

  return { activeVersion, handleVersionChange };
}
