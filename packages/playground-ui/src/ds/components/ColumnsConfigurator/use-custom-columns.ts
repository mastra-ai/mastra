import { useCallback, useState } from 'react';
import type { CustomColumnConfig } from './columns-configurator';

function loadFromStorage(storageKey: string): CustomColumnConfig[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is CustomColumnConfig =>
        !!c &&
        typeof c.name === 'string' &&
        typeof c.key === 'string' &&
        typeof c.label === 'string' &&
        typeof c.source === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Manages the user's custom column definitions for a list view, persisting
 * them under `storageKey` in localStorage. Pairs with `useColumnPreferences`
 * (visible-name state) and `<ColumnsConfigurator>` (UI for editing both).
 *
 * Returns `{ customColumns, addCustomColumn, removeCustomColumn }` — the
 * handlers are stable references safe to pass straight through to
 * `<ColumnsConfigurator>`.
 */
export function useCustomColumns(storageKey: string): {
  customColumns: CustomColumnConfig[];
  addCustomColumn: (column: Omit<CustomColumnConfig, 'name'>) => void;
  removeCustomColumn: (name: string) => void;
} {
  const [customColumns, setCustomColumns] = useState<CustomColumnConfig[]>(() => loadFromStorage(storageKey));

  const persist = useCallback(
    (updater: (prev: CustomColumnConfig[]) => CustomColumnConfig[]) => {
      setCustomColumns(prev => {
        const next = updater(prev);
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Storage unavailable (private mode, quota) — state still reflects user intent
        }
        return next;
      });
    },
    [storageKey],
  );

  const addCustomColumn = useCallback(
    (column: Omit<CustomColumnConfig, 'name'>) => {
      const name = `${column.source}:${column.key}`;
      persist(prev => (prev.some(c => c.name === name) ? prev : [...prev, { ...column, name }]));
    },
    [persist],
  );

  const removeCustomColumn = useCallback(
    (name: string) => {
      persist(prev => prev.filter(c => c.name !== name));
    },
    [persist],
  );

  return { customColumns, addCustomColumn, removeCustomColumn };
}
