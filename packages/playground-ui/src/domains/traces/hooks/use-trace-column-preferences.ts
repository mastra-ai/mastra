import { useTraceColumnPreferencesStorageKey } from '@mastra/react/hooks/traces';
import { useEffect, useState } from 'react';
import {
  DEFAULT_TRACE_COLUMN_PREFERENCES,
  parseTraceColumnPreferences,
  serializeTraceColumnPreferences,
} from '../trace-list-columns';
import type { TraceColumnPreferences, TraceCustomColumn, TraceOptionalColumn } from '../trace-list-columns';

export function readTraceColumnPreferences(storageKey: string): TraceColumnPreferences {
  if (typeof window === 'undefined') return DEFAULT_TRACE_COLUMN_PREFERENCES;

  try {
    return parseTraceColumnPreferences(window.localStorage.getItem(storageKey) ?? undefined);
  } catch {
    return DEFAULT_TRACE_COLUMN_PREFERENCES;
  }
}

export function writeTraceColumnPreferences(storageKey: string, preferences: TraceColumnPreferences): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey, serializeTraceColumnPreferences(preferences));
  } catch {
    // Storage can be unavailable in private browsing or full. The in-memory
    // selection still works for the current visit.
  }
}

type TraceColumnPreferencesUpdate = (current: TraceColumnPreferences) => TraceColumnPreferences;

/** The columns menu's actions, over whatever stores the preferences: each one hands `commit` an update. */
export function traceColumnActions(commit: (update: TraceColumnPreferencesUpdate) => void) {
  return {
    toggleColumn: (column: TraceOptionalColumn) => {
      commit(current => {
        const isVisible = current.visibleColumns.includes(column);
        return {
          ...current,
          visibleColumns: isVisible
            ? current.visibleColumns.filter(visibleColumn => visibleColumn !== column)
            : [...current.visibleColumns, column],
        };
      });
    },
    addMetadataColumn: (key: string) => {
      const normalizedKey = key.trim();
      if (!normalizedKey) return;
      commit(current =>
        current.metadataKeys.includes(normalizedKey)
          ? current
          : { ...current, metadataKeys: [...current.metadataKeys, normalizedKey] },
      );
    },
    removeMetadataColumn: (key: string) => {
      commit(current => ({
        ...current,
        metadataKeys: current.metadataKeys.filter(metadataKey => metadataKey !== key),
      }));
    },
    addCustomColumn: (field: TraceCustomColumn) => {
      commit(current =>
        current.customColumns.includes(field)
          ? current
          : { ...current, customColumns: [...current.customColumns, field] },
      );
    },
    removeCustomColumn: (field: TraceCustomColumn) => {
      commit(current => ({
        ...current,
        customColumns: current.customColumns.filter(customColumn => customColumn !== field),
      }));
    },
    resetColumns: () => commit(() => DEFAULT_TRACE_COLUMN_PREFERENCES),
  };
}

export function useTraceColumnPreferences() {
  const storageKey = useTraceColumnPreferencesStorageKey();
  const [state, setState] = useState(() => ({
    storageKey,
    preferences: readTraceColumnPreferences(storageKey),
    shouldPersist: false,
  }));
  const preferences = state.storageKey === storageKey ? state.preferences : readTraceColumnPreferences(storageKey);

  useEffect(() => {
    if (state.storageKey === storageKey && state.shouldPersist) {
      writeTraceColumnPreferences(storageKey, state.preferences);
    }
  }, [state, storageKey]);

  const commit = (update: TraceColumnPreferencesUpdate) => {
    setState(current => {
      const currentPreferences =
        current.storageKey === storageKey ? current.preferences : readTraceColumnPreferences(storageKey);
      const nextPreferences = update(currentPreferences);
      return { storageKey, preferences: nextPreferences, shouldPersist: true };
    });
  };

  return { preferences, ...traceColumnActions(commit) };
}
