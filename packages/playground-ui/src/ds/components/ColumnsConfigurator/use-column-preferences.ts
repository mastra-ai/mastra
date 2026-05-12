import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Persists a list of visible column names in localStorage under `storageKey`.
 *
 * Stored names are loaded verbatim (no validation against `allColumnNames`) so
 * dynamically-discovered column names (e.g. metadata keys) survive refreshes
 * that happen before discovery runs. Stale entries self-heal the next time the
 * user toggles a column on, since the configurator rebuilds the visible list
 * from its current `columns` prop.
 *
 * Returns `[visibleColumns, setVisibleColumns, resetToDefault]`.
 * `resetToDefault` restores the original `defaultVisible` (or `allColumnNames`
 * when unset), captured at first render.
 */
export function useColumnPreferences(
  storageKey: string,
  allColumnNames: string[],
  defaultVisible?: string[],
): [string[], (names: string[]) => void, () => void] {
  // Snapshot the default once so callers passing an inline array don't churn reset behavior
  const defaultRef = useRef<string[]>(defaultVisible ?? allColumnNames);

  const [visibleColumns, setVisibleColumnsState] = useState<string[]>(() => defaultRef.current);

  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        // No stored value for this key — reset to the initial default so a
        // changing `storageKey` doesn't leak the previous key's selection.
        setVisibleColumnsState(defaultRef.current);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const next = parsed.filter((n): n is string => typeof n === 'string');
      setVisibleColumnsState(next);
    } catch {
      // Corrupt or unavailable storage — fall back to defaults already in state
    }
  }, [storageKey]);

  const setVisibleColumns = useCallback(
    (names: string[]) => {
      setVisibleColumnsState(names);
      try {
        localStorage.setItem(storageKey, JSON.stringify(names));
      } catch {
        // Storage unavailable (private mode, quota) — state still reflects user intent
      }
    },
    [storageKey],
  );

  const resetToDefault = useCallback(() => {
    setVisibleColumns(defaultRef.current);
  }, [setVisibleColumns]);

  return [visibleColumns, setVisibleColumns, resetToDefault];
}
