import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearSavedTraceFilters,
  hasAnyTraceFilterParams,
  loadTraceFiltersFromStorage,
  saveTraceFiltersToStorage,
} from '../trace-filters';
import type { SetURLSearchParamsLike } from './use-trace-url-state';
import { toast } from '@/lib/toast';

const DEFAULT_SAVED_MESSAGE = 'Trace filter settings saved.';
const DEFAULT_CLEARED_MESSAGE = 'Trace filter settings cleared.';

export interface TraceFilterPersistenceOptions {
  /** Override the localStorage key. Default: traces filters storage. */
  storageKey?: string;
  /** Toast text overrides; pass `false` to suppress the toast entirely. */
  messages?: {
    saved?: string | false;
    cleared?: string | false;
  };
  /** Skip the once-on-mount hydration from localStorage. Default: false (hydration runs). */
  skipHydration?: boolean;
}

export interface UseTraceFilterPersistenceResult {
  /** True when localStorage has a previously saved filter set. */
  hasSavedFilters: boolean;
  /** Persist the current URL filter params to localStorage. */
  handleSave: () => void;
  /** Forget the saved filter set. */
  handleRemoveSaved: () => void;
}

/**
 * Owns the localStorage save/restore lifecycle for trace filters:
 * - tracks `hasSavedFilters`
 * - exposes `handleSave` / `handleRemoveSaved` (with toast feedback)
 * - hydrates the URL from saved filters once on mount, but only if the URL is filter-clean
 *   (so a shared link / direct nav with explicit filters wins over the saved set)
 *
 * Pass `storageKey` to scope persistence (e.g. per-project). Pass `messages.{saved,cleared} = false`
 * to suppress the toast.
 */
export function useTraceFilterPersistence(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParamsLike,
  options?: TraceFilterPersistenceOptions,
): UseTraceFilterPersistenceResult {
  const { storageKey, messages, skipHydration } = options ?? {};

  const [hasSavedFilters, setHasSavedFilters] = useState(() => loadTraceFiltersFromStorage(storageKey) !== null);

  const handleSave = useCallback(() => {
    saveTraceFiltersToStorage(searchParams, storageKey);
    setHasSavedFilters(true);
    const text = messages?.saved ?? DEFAULT_SAVED_MESSAGE;
    if (text !== false) toast.success(text);
  }, [searchParams, storageKey, messages?.saved]);

  const handleRemoveSaved = useCallback(() => {
    clearSavedTraceFilters(storageKey);
    setHasSavedFilters(false);
    const text = messages?.cleared ?? DEFAULT_CLEARED_MESSAGE;
    if (text !== false) toast.success(text);
  }, [storageKey, messages?.cleared]);

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

  return { hasSavedFilters, handleSave, handleRemoveSaved };
}
