import { useEffect, useRef } from 'react';
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
 * - saves the filter params on every change afterwards; only relative date presets are
 *   kept (see `saveTraceFiltersToStorage`)
 *
 * Pass `storageKey` to scope persistence (e.g. per-entity).
 */
export function useTraceFilterPersistence(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParamsLike,
  options?: TraceFilterPersistenceOptions,
): void {
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

  // Save on change only: the URL at mount is either about to be hydrated (empty) or an explicit
  // link, and neither should overwrite what the user last used.
  const search = searchParams.toString();
  const lastSavedSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastSavedSearchRef.current === null) {
      lastSavedSearchRef.current = search;
      return;
    }
    if (lastSavedSearchRef.current === search) return;
    lastSavedSearchRef.current = search;
    saveTraceFiltersToStorage(new URLSearchParams(search), storageKey);
  }, [search, storageKey]);
}
