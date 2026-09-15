import { useMastraClient } from '@mastra/react';
import { useEffect, useState } from 'react';
import {
  DEFAULT_TRACE_COLUMN_PREFERENCES,
  parseTraceColumnPreferences,
  serializeTraceColumnPreferences,
} from '../trace-list-columns';
import type { TraceColumnPreferences, TraceOptionalColumn } from '../trace-list-columns';

function readPreferences(storageKey: string): TraceColumnPreferences {
  if (typeof window === 'undefined') return DEFAULT_TRACE_COLUMN_PREFERENCES;

  try {
    return parseTraceColumnPreferences(window.localStorage.getItem(storageKey) ?? undefined);
  } catch {
    return DEFAULT_TRACE_COLUMN_PREFERENCES;
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

export function useTraceColumnPreferences() {
  const client = useMastraClient();
  const projectUrl =
    client.options.baseUrl || (typeof window === 'undefined' ? 'local' : window.location.origin || 'local');
  const apiPrefix = client.options.apiPrefix ?? '/api';
  const storageKey = `mastra:traces:columns:${projectUrl}:${apiPrefix}`;
  const [state, setState] = useState(() => ({
    storageKey,
    preferences: readPreferences(storageKey),
    shouldPersist: false,
  }));
  const preferences = state.storageKey === storageKey ? state.preferences : readPreferences(storageKey);

  useEffect(() => {
    if (state.storageKey === storageKey && state.shouldPersist) {
      writePreferences(storageKey, state.preferences);
    }
  }, [state, storageKey]);

  const commit = (update: (current: TraceColumnPreferences) => TraceColumnPreferences) => {
    setState(current => {
      const currentPreferences = current.storageKey === storageKey ? current.preferences : readPreferences(storageKey);
      const nextPreferences = update(currentPreferences);
      return { storageKey, preferences: nextPreferences, shouldPersist: true };
    });
  };

  const toggleColumn = (column: TraceOptionalColumn) => {
    commit(current => {
      const isVisible = current.visibleColumns.includes(column);
      return {
        ...current,
        visibleColumns: isVisible
          ? current.visibleColumns.filter(visibleColumn => visibleColumn !== column)
          : [...current.visibleColumns, column],
      };
    });
  };

  const addMetadataColumn = (key: string) => {
    const normalizedKey = key.trim();
    if (!normalizedKey) return;
    commit(current =>
      current.metadataKeys.includes(normalizedKey)
        ? current
        : { ...current, metadataKeys: [...current.metadataKeys, normalizedKey] },
    );
  };

  const removeMetadataColumn = (key: string) => {
    commit(current => ({
      ...current,
      metadataKeys: current.metadataKeys.filter(metadataKey => metadataKey !== key),
    }));
  };

  const resetColumns = () => commit(() => DEFAULT_TRACE_COLUMN_PREFERENCES);

  return {
    preferences,
    toggleColumn,
    addMetadataColumn,
    removeMetadataColumn,
    resetColumns,
  };
}
