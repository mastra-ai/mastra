import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetURLSearchParamsLike } from '../../traces/hooks/use-trace-url-state';
import {
  clearSavedLogsFilters,
  hasAnyLogsFilterParams,
  loadLogsFiltersFromStorage,
  saveLogsFiltersToStorage,
} from '../log-filters';
import { toast } from '@/lib/toast';

const DEFAULT_SAVED_MESSAGE = 'Filters setting for Logs saved';
const DEFAULT_CLEARED_MESSAGE = 'Filters setting for Logs cleared up';

export interface LogsFilterPersistenceOptions {
  /** Override the localStorage key. Default: 'mastra:logs:saved-filters'. */
  storageKey?: string;
  /** Toast text overrides; pass `false` to suppress the toast entirely. */
  messages?: {
    saved?: string | false;
    cleared?: string | false;
  };
  /** Skip the once-on-mount hydration from localStorage. Default: false. */
  skipHydration?: boolean;
}

export interface UseLogsFilterPersistenceResult {
  hasSavedFilters: boolean;
  handleSave: () => void;
  handleRemoveSaved: () => void;
}

/**
 * Owns the localStorage save/restore lifecycle for logs filters. Mirrors
 * `useTraceFilterPersistence` — same pattern, different storage key default.
 */
export function useLogsFilterPersistence(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParamsLike,
  options?: LogsFilterPersistenceOptions,
): UseLogsFilterPersistenceResult {
  const { storageKey, messages, skipHydration } = options ?? {};

  const [hasSavedFilters, setHasSavedFilters] = useState(() => loadLogsFiltersFromStorage(storageKey) !== null);

  const handleSave = useCallback(() => {
    saveLogsFiltersToStorage(searchParams, storageKey);
    setHasSavedFilters(true);
    const text = messages?.saved ?? DEFAULT_SAVED_MESSAGE;
    if (text !== false) toast.success(text);
  }, [searchParams, storageKey, messages?.saved]);

  const handleRemoveSaved = useCallback(() => {
    clearSavedLogsFilters(storageKey);
    setHasSavedFilters(false);
    const text = messages?.cleared ?? DEFAULT_CLEARED_MESSAGE;
    if (text !== false) toast.success(text);
  }, [storageKey, messages?.cleared]);

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (skipHydration) return;
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (hasAnyLogsFilterParams(searchParams)) return;
    const saved = loadLogsFiltersFromStorage(storageKey);
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
