import type { TraceUsageSummary } from '../trace-list-columns';
import {
  formatSpanDuration,
  formatSpanDurationExact,
  formatSpanTimestamp,
  formatSpanTimestampExact,
} from '../utils/span-utils';
import { TraceStatusValue } from './trace-status-value';
import type { TraceStatusValueStatus } from './trace-status-value';
import { formatCompact, formatCost } from '@/domains/metrics/components/metrics-utils';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { cn } from '@/lib/utils';

const RESPONSIVE_GRID_COLUMNS: Record<1 | 2 | 3, string> = {
  1: 'grid-cols-[auto_1fr]!',
  2: 'grid-cols-[auto_1fr]! @md:grid-cols-[auto_auto_auto_1fr]!',
  3: 'grid-cols-[auto_1fr]! @md:grid-cols-[auto_auto_auto_1fr]! @xl:grid-cols-[auto_auto_auto_auto_auto_1fr]!',
};

function computeTraceStatus(span: { error?: unknown; endedAt?: Date | string | null }): TraceStatusValueStatus {
  if (span.error != null) return 'error';
  if (span.endedAt == null) return 'running';
  return 'success';
}

function formatEntityType(entityType: string): string {
  return entityType
    .split('_')
    .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

/** Lightweight root-span fields available from `useTraceLightSpans`. */
type RootSpanSummary = {
  entityId?: string | null;
  entityName?: string | null;
  entityType?: string | null;
  startedAt: Date | string;
  endedAt?: Date | string | null;
  error?: unknown;
};

export interface TraceKeysAndValuesProps {
  rootSpan: RootSpanSummary;
  /**
   * Token and estimated-cost totals aggregated across the trace's model spans
   * (from `useTraceUsage`). When provided, token and cost rows are rendered —
   * with `—` for values the metrics store couldn't produce (e.g. no pricing
   * match or mixed cost units).
   */
  usage?: TraceUsageSummary;
  numOfCol?: 1 | 2 | 3;
  className?: string;
  /**
   * When set, each key/value cell gets a `view-transition-name` prefixed with this
   * value, so rows morph smoothly (via the View Transitions API) when the layout
   * reflows — e.g. from two columns to one when the span panel opens. Must be
   * unique page-wide.
   */
  viewTransitionPrefix?: string;
}

export function TraceKeysAndValues({
  rootSpan,
  usage,
  numOfCol = 2,
  className,
  viewTransitionPrefix,
}: TraceKeysAndValuesProps) {
  // Arbitrary-value Tailwind classes can't be built dynamically, so use inline styles.
  const vt = (name: string): React.CSSProperties | undefined =>
    viewTransitionPrefix ? { viewTransitionName: `${viewTransitionPrefix}-${name}` } : undefined;
  const startedAt = rootSpan.startedAt ? new Date(rootSpan.startedAt) : null;
  const endedAt = rootSpan.endedAt ? new Date(rootSpan.endedAt) : null;
  const status = computeTraceStatus(rootSpan);
  const duration = formatSpanDuration(startedAt, endedAt);
  const exactDuration = formatSpanDurationExact(startedAt, endedAt);
  const startedAtTimestamp = formatSpanTimestamp(startedAt);
  const exactStartedAtTimestamp = formatSpanTimestampExact(startedAt);
  const endedAtTimestamp = formatSpanTimestamp(endedAt);
  const exactEndedAtTimestamp = formatSpanTimestampExact(endedAt);

  return (
    <div className="@container">
      <DataKeysAndValues numOfCol={numOfCol} className={cn(className, RESPONSIVE_GRID_COLUMNS[numOfCol])}>
        {rootSpan.entityId && (
          <>
            <DataKeysAndValues.Key style={vt('entity-key')}>Entity</DataKeysAndValues.Key>
            <DataKeysAndValues.Value style={vt('entity-val')}>
              {rootSpan.entityName || rootSpan.entityId}
            </DataKeysAndValues.Value>
          </>
        )}
        {rootSpan.entityType && (
          <>
            <DataKeysAndValues.Key style={vt('entity-type-key')}>Entity Type</DataKeysAndValues.Key>
            <DataKeysAndValues.Value style={vt('entity-type-val')}>
              {formatEntityType(rootSpan.entityType)}
            </DataKeysAndValues.Value>
          </>
        )}
        <DataKeysAndValues.Key style={vt('status-key')}>Status</DataKeysAndValues.Key>
        <DataKeysAndValues.Value style={vt('status-val')}>
          <TraceStatusValue status={status} />
        </DataKeysAndValues.Value>
        {duration && exactDuration && (
          <>
            <DataKeysAndValues.Key style={vt('duration-key')}>Duration</DataKeysAndValues.Key>
            <DataKeysAndValues.ValueWithTooltip tooltip={exactDuration} style={vt('duration-val')}>
              {duration}
            </DataKeysAndValues.ValueWithTooltip>
          </>
        )}
        {startedAtTimestamp && exactStartedAtTimestamp && (
          <>
            <DataKeysAndValues.Key style={vt('started-key')}>Started at</DataKeysAndValues.Key>
            <DataKeysAndValues.ValueWithTooltip tooltip={exactStartedAtTimestamp} style={vt('started-val')}>
              {startedAtTimestamp}
            </DataKeysAndValues.ValueWithTooltip>
          </>
        )}
        {endedAtTimestamp && exactEndedAtTimestamp && (
          <>
            <DataKeysAndValues.Key style={vt('ended-key')}>Ended at</DataKeysAndValues.Key>
            <DataKeysAndValues.ValueWithTooltip tooltip={exactEndedAtTimestamp} style={vt('ended-val')}>
              {endedAtTimestamp}
            </DataKeysAndValues.ValueWithTooltip>
          </>
        )}
        {usage && (
          <>
            <DataKeysAndValues.Key style={vt('input-tokens-key')}>Trace input tokens</DataKeysAndValues.Key>
            <DataKeysAndValues.Value style={vt('input-tokens-val')}>
              {usage.inputTokens === undefined ? '—' : formatCompact(usage.inputTokens)}
            </DataKeysAndValues.Value>
            <DataKeysAndValues.Key style={vt('output-tokens-key')}>Trace output tokens</DataKeysAndValues.Key>
            <DataKeysAndValues.Value style={vt('output-tokens-val')}>
              {usage.outputTokens === undefined ? '—' : formatCompact(usage.outputTokens)}
            </DataKeysAndValues.Value>
            <DataKeysAndValues.Key style={vt('cost-key')}>Trace est. cost</DataKeysAndValues.Key>
            <DataKeysAndValues.Value style={vt('cost-val')}>
              {usage.estimatedCost === undefined ? '—' : formatCost(usage.estimatedCost, usage.costUnit)}
            </DataKeysAndValues.Value>
          </>
        )}
      </DataKeysAndValues>
    </div>
  );
}
