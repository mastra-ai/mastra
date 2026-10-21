import { useTraceColumnPreferencesStorageKey } from '@mastra/react/hooks/traces';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import type { TraceColumnPreferences } from '../trace-list-columns';
import { readTraceColumnPreferences, writeTraceColumnPreferences } from './use-trace-column-preferences';
import { getColumnOrderStorageKey, keyedColumnOrderSchema } from '@/ds/components/DataList/data-list-column-order';

/** The traces table setup: which columns show, and their order as column keys (see `buildTraceListColumnKeys`). */
export type TracesColumnsState = {
  preferences: TraceColumnPreferences;
  order: string[];
};

function readColumnOrder(storageKey: string): string[] {
  try {
    const parsed = keyedColumnOrderSchema.safeParse(JSON.parse(window.localStorage.getItem(storageKey) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function writeColumnOrder(storageKey: string, order: string[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(order));
  } catch {
    // Storage can be unavailable in private browsing or full; the order still applies for this visit.
  }
}

/**
 * The traces columns and their order, for a host that controls `TracesExplorer`'s columns (e.g. to
 * save them in a view). Reads and writes the same browser storage as the explorer's own columns
 * and `listId`'s column order, so a user's setup carries over. Nothing is written until it changes.
 */
export function useTraceColumnsState(
  listId: string,
): [TracesColumnsState, Dispatch<SetStateAction<TracesColumnsState>>] {
  const preferencesKey = useTraceColumnPreferencesStorageKey();
  const orderKey = getColumnOrderStorageKey(listId);
  const [columns, setColumns] = useState<TracesColumnsState>(() => ({
    preferences: readTraceColumnPreferences(preferencesKey),
    order: readColumnOrder(orderKey),
  }));
  const [initialColumns] = useState(columns);

  useEffect(() => {
    if (columns === initialColumns) return;
    writeTraceColumnPreferences(preferencesKey, columns.preferences);
    writeColumnOrder(orderKey, columns.order);
  }, [columns, initialColumns, preferencesKey, orderKey]);

  return [columns, setColumns];
}
