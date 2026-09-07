import { useCallback, useEffect, useRef } from 'react';
import { hasAnyTraceFilterParams, loadTraceFiltersFromStorage, saveTraceFiltersToStorage } from '../trace-filters';
import type { SetURLSearchParamsLike } from './use-trace-url-state';

export interface TraceFilterPersistenceOptions {
  /** Override the localStorage key. Default: traces filters storage. */
  storageKey?: string;
  /** Skip the once-on-mount hydration from localStorage. Default: false (hydration runs). */
  skipHydration?: boolean;
}

/**
 * Owns the localStorage save/restore lifecycle for trace filters:
 * - hydrates the URL from saved filters once on mount, but only if the URL is filter-clean
 *   (so a shared link / direct nav with explicit filters wins over the saved set)
 * - returns a `setSearchParams` wrapper that persists the resulting params as part of the
 *   update itself; only relative date presets are kept (see `saveTraceFiltersToStorage`).
 *   Route every filter mutation through the returned setter (e.g. hand it to `useTraceUrlState`).
 *
 * Pass `storageKey` to scope persistence (e.g. per-entity).
 */
export function useTraceFilterPersistence(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParamsLike,
  options?: TraceFilterPersistenceOptions,
): SetURLSearchParamsLike {
  const { storageKey, skipHydration } = options ?? {};

  // Hydrate from the saved filter set on mount, but only when the URL is
  // filter-clean (user arrived via a plain sidebar nav). If the URL already
  // carries filters — e.g. a shared link — leave it alone.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (skipHydration) return;
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (hasAnyTraceFilterParams(searchParams)) return;
    const saved = loadTraceFiltersFromStorage(storageKey);
    if (!saved) return;
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of saved) {
          next.append(key, value);
        }
        return next;
      },
      { replace: true },
    );
    // Run once on mount — searchParams intentionally read at mount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist as part of the user's update rather than by observing the URL: the URL at mount
  // is either about to be hydrated (empty) or an explicit link, and neither is "what the user
  // last chose".
  return useCallback<SetURLSearchParamsLike>(
    (next, setOptions) => {
      setSearchParams(prev => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        saveTraceFiltersToStorage(resolved, storageKey);
        return resolved;
      }, setOptions);
    },
    [setSearchParams, storageKey],
  );
}
