import { useMemo } from 'react';
import {
  TRACE_COLUMN_CATALOGS,
  addTraceCustomColumn,
  addTraceMetadataColumn,
  removeTraceCustomColumn,
  removeTraceMetadataColumn,
  toggleTraceColumn,
} from '../../trace-list-columns';
import type { TraceColumnCatalog } from '../../trace-list-columns';
import { TraceColumnsMenu } from '../trace-columns-menu';
import { useTraceUsageColumns, useTracesColumns, useTracesConfig } from './traces-explorer-context';
import type { TracesExplorerDiscovery } from './traces-explorer-data';

const CATALOG = TRACE_COLUMN_CATALOGS.traces;
const NO_KEYS: readonly string[] = [];

/** The catalog without the streaming columns the store doesn't record. */
const offeredCatalog = (withTimeToFirstChunk: boolean, withTimeToFirstToken: boolean): TraceColumnCatalog => {
  if (withTimeToFirstChunk && withTimeToFirstToken) return CATALOG;
  const standardColumns = CATALOG.standardColumns.filter(
    column =>
      (withTimeToFirstChunk || column !== 'timeToFirstChunk') &&
      (withTimeToFirstToken || column !== 'timeToFirstToken'),
  );
  return { ...CATALOG, standardColumns };
};

/** Metadata columns read top-level keys only, so nested paths collapse to their first segment. */
const metadataKeysOf = (fields: TracesExplorerDiscovery['fields']) => {
  const keys = new Set<string>();
  for (const field of fields) {
    const key = field.path.replace(/^metadata\./, '').split('.')[0];
    if (key) keys.add(key);
  }
  return [...keys].sort();
};

/** The "Columns" picker of the traces list, offering the metadata keys discovered in the explorer's window. */
export function TracesExplorerColumnsMenu() {
  const { preferences, setPreferences, resetColumns } = useTracesColumns();
  const { usageDisabledReason } = useTraceUsageColumns();
  const {
    withQueryTrace,
    withDiscovery,
    withTimeToFirstChunk,
    withTimeToFirstToken,
    isCapabilitiesLoading,
    discovery,
  } = useTracesConfig();

  // Memoized for correctness: the keys become the metadata Combobox's items, which loop on a new array every render.
  const availableMetadataKeys = useMemo(
    () => (withDiscovery ? metadataKeysOf(discovery.fields) : NO_KEYS),
    [withDiscovery, discovery.fields],
  );

  return (
    <TraceColumnsMenu
      preferences={preferences}
      catalog={offeredCatalog(withTimeToFirstChunk, withTimeToFirstToken)}
      availableMetadataKeys={availableMetadataKeys}
      usageDisabledReason={usageDisabledReason}
      withQueryTrace={withQueryTrace}
      disabled={isCapabilitiesLoading}
      onToggleColumn={column => setPreferences(toggleTraceColumn(preferences, column))}
      onAddCustomColumn={column => setPreferences(addTraceCustomColumn(preferences, column))}
      onRemoveCustomColumn={column => setPreferences(removeTraceCustomColumn(preferences, column))}
      onAddMetadataColumn={key => setPreferences(addTraceMetadataColumn(preferences, key))}
      onRemoveMetadataColumn={key => setPreferences(removeTraceMetadataColumn(preferences, key))}
      onReset={resetColumns}
    />
  );
}
