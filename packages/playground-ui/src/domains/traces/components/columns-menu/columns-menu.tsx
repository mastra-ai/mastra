import { useTraceMetadataFilterFields } from '@mastra/react/hooks/traces';
import type { TraceQueryDiscoveryTimeRange } from '@mastra/react/hooks/traces';
import { memo, useMemo, useState } from 'react';
import {
  TRACE_COLUMN_CATALOGS,
  addTraceCustomColumn,
  addTraceMetadataColumn,
  removeTraceCustomColumn,
  removeTraceMetadataColumn,
  toggleTraceColumn,
} from '../../trace-list-columns';
import type { TraceColumnPreferences, TraceColumnScope } from '../../trace-list-columns';
import { resolveTraceQueryTimeRange } from '../../trace-query-filters';
import { TraceColumnsMenu } from '../trace-columns-menu';
import { CHECKING_USAGE_REASON, UNSUPPORTED_USAGE_REASON } from '../traces-explorer/traces-explorer-context';
import type { TracesMetricsSupport } from '../traces-explorer/traces-explorer-context';
import { useSpanQueryAvailable, useTraceQueryAvailable, useTraceQueryDiscoveryAvailable } from '@/domains/capabilities';

export type ColumnsMenuScope = TraceColumnScope | 'threads';

export type ColumnsMenuProps = {
  /** Which list the columns belong to. Each scope offers only the columns its rows carry; threads renders nothing. */
  scope: ColumnsMenuScope;
  /** The active column selection. The host owns it (and its persistence). */
  value: TraceColumnPreferences;
  /** Receives the whole next selection on every change. */
  onChange: (next: TraceColumnPreferences) => void;
  /** Window metadata keys are discovered in. Pass the list's range to share the filter bar's cached discovery. Defaults to the last seven days. */
  discoveryTimeRange?: TraceQueryDiscoveryTimeRange;
  /** Whether the store reports token and cost metrics (traces only). Usage columns are unavailable when omitted. */
  metricsSupport?: TracesMetricsSupport;
  /** Host-level switch for the query API. When false, metadata columns can't be added. Defaults to true. */
  queryEnabled?: boolean;
};

type ScopedColumnsMenuProps = Omit<ColumnsMenuProps, 'scope'> & { scope: TraceColumnScope };

const UNSUPPORTED_METRICS: TracesMetricsSupport = { supported: false, isLoading: false };

function useQueryAvailable(scope: TraceColumnScope) {
  const traceQuery = useTraceQueryAvailable();
  const spanQuery = useSpanQueryAvailable();
  return scope === 'spans' ? spanQuery : traceQuery;
}

const ScopedColumnsMenu = memo(function ScopedColumnsMenu({
  scope,
  value,
  onChange,
  discoveryTimeRange,
  metricsSupport = UNSUPPORTED_METRICS,
  queryEnabled = true,
}: ScopedColumnsMenuProps) {
  const catalog = TRACE_COLUMN_CATALOGS[scope];
  const queryAvailable = useQueryAvailable(scope);
  const discoveryAvailable = useTraceQueryDiscoveryAvailable();
  const [defaultTimeRange] = useState(() => resolveTraceQueryTimeRange(undefined, undefined, new Date()));

  const withQuery = queryAvailable.enabled && queryEnabled;
  const { fields } = useTraceMetadataFilterFields({
    timeRange: discoveryTimeRange ?? defaultTimeRange,
    queryOptions: { enabled: catalog.metadata && withQuery && discoveryAvailable.enabled },
  });

  // Metadata columns read top-level keys only, so nested paths collapse to their first segment.
  const availableMetadataKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const field of fields) {
      const key = field.path.replace(/^metadata\./, '').split('.')[0];
      if (key) keys.add(key);
    }
    return [...keys].sort();
  }, [fields]);

  const usageDisabledReason = metricsSupport.isLoading
    ? CHECKING_USAGE_REASON
    : metricsSupport.supported
      ? undefined
      : UNSUPPORTED_USAGE_REASON;

  return (
    <TraceColumnsMenu
      preferences={value}
      catalog={catalog}
      availableMetadataKeys={availableMetadataKeys}
      usageDisabledReason={usageDisabledReason}
      withQueryTrace={withQuery}
      disabled={queryAvailable.isLoading}
      onToggleColumn={column => onChange(toggleTraceColumn(value, column))}
      onAddCustomColumn={column => onChange(addTraceCustomColumn(value, column))}
      onRemoveCustomColumn={column => onChange(removeTraceCustomColumn(value, column))}
      onAddMetadataColumn={key => onChange(addTraceMetadataColumn(value, key))}
      onRemoveMetadataColumn={key => onChange(removeTraceMetadataColumn(value, key))}
      onReset={() => onChange(catalog.defaults)}
    />
  );
});

/**
 * The "Columns" picker for a trace-style list. Offers the scope's own column catalog, checks
 * the scope's query capability, and (for traces) discovers the metadata keys observed in the
 * time range on its own; the host only owns the selection.
 */
export function ColumnsMenu({ scope, ...props }: ColumnsMenuProps) {
  if (scope === 'threads') return null;
  return <ScopedColumnsMenu scope={scope} {...props} />;
}
