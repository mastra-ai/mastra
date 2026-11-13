import { useTraceColumnPreferencesStorageKey } from '@mastra/react/hooks/traces';
import { useEffect, useState } from 'react';
import {
  TRACE_COLUMN_CATALOGS,
  addTraceCustomColumn,
  addTraceMetadataColumn,
  parseTraceColumnPreferences,
  removeTraceCustomColumn,
  removeTraceMetadataColumn,
  serializeTraceColumnPreferences,
  toggleTraceColumn,
} from '../trace-list-columns';
import type {
  TraceColumnPreferences,
  TraceColumnScope,
  TraceCustomColumn,
  TraceOptionalColumn,
} from '../trace-list-columns';

function readPreferences(storageKey: string, defaults: TraceColumnPreferences): TraceColumnPreferences {
  if (typeof window === 'undefined') return defaults;

  try {
    return parseTraceColumnPreferences(window.localStorage.getItem(storageKey) ?? undefined, defaults);
  } catch {
    return defaults;
  }
}

function writePreferences(storageKey: string, preferences: TraceColumnPreferences): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey, serializeTraceColumnPreferences(preferences));
  } catch {
    // Storage can be unavailable in private browsing or full. The in-memory
    // selection still works for the current visit.
  }
}

export function useTraceColumnPreferences({ scope = 'traces' }: { scope?: TraceColumnScope } = {}) {
  const storageKey = useTraceColumnPreferencesStorageKey(scope);
  const { defaults } = TRACE_COLUMN_CATALOGS[scope];
  const [state, setState] = useState(() => ({
    storageKey,
    preferences: readPreferences(storageKey, defaults),
    shouldPersist: false,
  }));
  const preferences = state.storageKey === storageKey ? state.preferences : readPreferences(storageKey, defaults);

  useEffect(() => {
    if (state.storageKey === storageKey && state.shouldPersist) {
      writePreferences(storageKey, state.preferences);
    }
  }, [state, storageKey]);

  const commit = (update: (current: TraceColumnPreferences) => TraceColumnPreferences) => {
    setState(current => {
      const isCurrentKey = current.storageKey === storageKey;
      const currentPreferences = isCurrentKey ? current.preferences : readPreferences(storageKey, defaults);
      const nextPreferences = update(currentPreferences);
      if (isCurrentKey && nextPreferences === currentPreferences) return current;
      return { storageKey, preferences: nextPreferences, shouldPersist: true };
    });
  };

  const setPreferences = (next: TraceColumnPreferences) => commit(() => next);
  const toggleColumn = (column: TraceOptionalColumn) => commit(current => toggleTraceColumn(current, column));
  const addMetadataColumn = (key: string) => commit(current => addTraceMetadataColumn(current, key));
  const removeMetadataColumn = (key: string) => commit(current => removeTraceMetadataColumn(current, key));
  const addCustomColumn = (field: TraceCustomColumn) => commit(current => addTraceCustomColumn(current, field));
  const removeCustomColumn = (field: TraceCustomColumn) => commit(current => removeTraceCustomColumn(current, field));
  const resetColumns = () => commit(() => defaults);

  return {
    preferences,
    setPreferences,
    toggleColumn,
    addCustomColumn,
    removeCustomColumn,
    addMetadataColumn,
    removeMetadataColumn,
    resetColumns,
  };
}
