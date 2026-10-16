import { useTraceColumnPreferencesStorageKey } from '@mastra/react/hooks/traces';
import { useEffect, useState } from 'react';
import { DEFAULT_TRACE_GROUP_COLUMNS, parseTraceGroupColumns } from '../trace-group-by';
import type { TraceGroupByMeasure } from '../trace-group-by';

function readColumns(storageKey: string): TraceGroupByMeasure[] {
  if (typeof window === 'undefined') return [...DEFAULT_TRACE_GROUP_COLUMNS];

  try {
    const stored = window.localStorage.getItem(storageKey);
    return parseTraceGroupColumns(stored === null ? undefined : JSON.parse(stored));
  } catch {
    return [...DEFAULT_TRACE_GROUP_COLUMNS];
  }
}

function writeColumns(storageKey: string, columns: readonly TraceGroupByMeasure[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(columns));
  } catch {
    // Storage can be unavailable in private browsing or full. The in-memory
    // selection still works for the current visit.
  }
}

/**
 * The grouped view's visible measure columns, saved per server like the trace list's columns. The trace count
 * is always shown.
 */
export function useTraceGroupColumnPreferences() {
  const storageKey = `${useTraceColumnPreferencesStorageKey()}:groups`;
  const [state, setState] = useState(() => ({
    storageKey,
    columns: readColumns(storageKey),
    shouldPersist: false,
  }));
  const columns = state.storageKey === storageKey ? state.columns : readColumns(storageKey);

  useEffect(() => {
    if (state.storageKey === storageKey && state.shouldPersist) {
      writeColumns(storageKey, state.columns);
    }
  }, [state, storageKey]);

  const commit = (update: (current: TraceGroupByMeasure[]) => TraceGroupByMeasure[]) => {
    setState(current => {
      const currentColumns = current.storageKey === storageKey ? current.columns : readColumns(storageKey);
      return { storageKey, columns: parseTraceGroupColumns(update(currentColumns)), shouldPersist: true };
    });
  };

  const toggleColumn = (measure: TraceGroupByMeasure) => {
    commit(current =>
      current.includes(measure) ? current.filter(column => column !== measure) : [...current, measure],
    );
  };

  const resetColumns = () => commit(() => [...DEFAULT_TRACE_GROUP_COLUMNS]);

  return { columns, toggleColumn, resetColumns };
}
