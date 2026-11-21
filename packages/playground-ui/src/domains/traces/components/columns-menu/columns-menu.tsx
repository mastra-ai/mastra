import { memo, useMemo } from 'react';
import {
  TRACE_COLUMN_CATALOGS,
  addTraceCustomColumn,
  addTraceMetadataColumn,
  removeTraceCustomColumn,
  removeTraceMetadataColumn,
  toggleTraceColumn,
} from '../../trace-list-columns';
import type { TraceColumnPreferences, TraceColumnScope } from '../../trace-list-columns';
import { TraceColumnsMenu } from '../trace-columns-menu';
import { CHECKING_USAGE_REASON, UNSUPPORTED_USAGE_REASON } from '../traces-explorer/traces-explorer-context';
import type { TracesMetricsSupport } from '../traces-explorer/traces-explorer-context';

export type ColumnsMenuScope = TraceColumnScope;

/** What the store can do for the list, as the host read it from its capabilities. */
export type ColumnsMenuSupport = {
  /** Capabilities are still loading: the menu stays disabled. */
  isLoading: boolean;
  /** The store answers the scope's query API. Off, no metadata or streaming-timing columns are offered. */
  withQuery: boolean;
  withTimeToFirstChunk: boolean;
  withTimeToFirstToken: boolean;
};

export type ColumnsMenuProps = {
  /** Which list the columns belong to. Each scope offers only the columns its rows carry. */
  scope: ColumnsMenuScope;
  /** The active column selection. The host owns it (and its persistence). */
  value: TraceColumnPreferences;
  /** Receives the whole next selection on every change. */
  onChange: (next: TraceColumnPreferences) => void;
  support: ColumnsMenuSupport;
  /** Top-level metadata keys the user can add as columns (traces only). */
  metadataKeys?: readonly string[];
  /** Whether the store reports token and cost metrics (traces only). Usage columns are unavailable when omitted. */
  metricsSupport?: TracesMetricsSupport;
};

const UNSUPPORTED_METRICS: TracesMetricsSupport = { supported: false, isLoading: false };
const NO_METADATA_KEYS: readonly string[] = [];

/** The "Columns" picker for a trace-style list. Offers the scope's own column catalog; the host owns the selection. */
export const ColumnsMenu = memo(function ColumnsMenu({
  scope,
  value,
  onChange,
  support,
  metadataKeys = NO_METADATA_KEYS,
  metricsSupport = UNSUPPORTED_METRICS,
}: ColumnsMenuProps) {
  const catalog = TRACE_COLUMN_CATALOGS[scope];
  const withTimeToFirstChunk = support.withQuery && support.withTimeToFirstChunk;
  const withTimeToFirstToken = support.withQuery && support.withTimeToFirstToken;
  const offeredCatalog = useMemo(() => {
    if (withTimeToFirstChunk && withTimeToFirstToken) return catalog;
    const standardColumns = catalog.standardColumns.filter(
      column =>
        (withTimeToFirstChunk || column !== 'timeToFirstChunk') &&
        (withTimeToFirstToken || column !== 'timeToFirstToken'),
    );
    return { ...catalog, standardColumns };
  }, [catalog, withTimeToFirstChunk, withTimeToFirstToken]);

  const usageDisabledReason = metricsSupport.isLoading
    ? CHECKING_USAGE_REASON
    : metricsSupport.supported
      ? undefined
      : UNSUPPORTED_USAGE_REASON;

  return (
    <TraceColumnsMenu
      preferences={value}
      catalog={offeredCatalog}
      availableMetadataKeys={catalog.metadata && support.withQuery ? metadataKeys : NO_METADATA_KEYS}
      usageDisabledReason={usageDisabledReason}
      withQueryTrace={support.withQuery}
      disabled={support.isLoading}
      onToggleColumn={column => onChange(toggleTraceColumn(value, column))}
      onAddCustomColumn={column => onChange(addTraceCustomColumn(value, column))}
      onRemoveCustomColumn={column => onChange(removeTraceCustomColumn(value, column))}
      onAddMetadataColumn={key => onChange(addTraceMetadataColumn(value, key))}
      onRemoveMetadataColumn={key => onChange(removeTraceMetadataColumn(value, key))}
      onReset={() => onChange(catalog.defaults)}
    />
  );
});
