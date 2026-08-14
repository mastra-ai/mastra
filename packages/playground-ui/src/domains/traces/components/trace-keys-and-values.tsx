import { format } from 'date-fns';
import type { TraceUsageSummary } from '../trace-list-columns';
import { formatCompact, formatCost } from '@/domains/metrics/components/metrics-utils';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';

enum TraceStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  RUNNING = 'running',
}

function computeTraceStatus(span: { error?: unknown; endedAt?: Date | string | null }): TraceStatus {
  if (span.error != null) return TraceStatus.ERROR;
  if (span.endedAt == null) return TraceStatus.RUNNING;
  return TraceStatus.SUCCESS;
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
}

export function TraceKeysAndValues({ rootSpan, usage, numOfCol = 2, className }: TraceKeysAndValuesProps) {
  const startedAt = rootSpan.startedAt ? new Date(rootSpan.startedAt) : null;
  const endedAt = rootSpan.endedAt ? new Date(rootSpan.endedAt) : null;
  const status = computeTraceStatus(rootSpan);
  const statusLabel = status === TraceStatus.ERROR ? 'ERROR' : status === TraceStatus.RUNNING ? 'RUNNING' : 'SUCCESS';

  return (
    <DataKeysAndValues numOfCol={numOfCol} className={className}>
      {rootSpan.entityId && (
        <>
          <DataKeysAndValues.Key>Entity Id</DataKeysAndValues.Key>
          <DataKeysAndValues.Value>{rootSpan.entityName || rootSpan.entityId}</DataKeysAndValues.Value>
        </>
      )}
      {rootSpan.entityType && (
        <>
          <DataKeysAndValues.Key>Entity Type</DataKeysAndValues.Key>
          <DataKeysAndValues.Value>{rootSpan.entityType}</DataKeysAndValues.Value>
        </>
      )}
      <DataKeysAndValues.Key>Status</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>{statusLabel}</DataKeysAndValues.Value>
      {startedAt && endedAt && (
        <>
          <DataKeysAndValues.Key>Duration</DataKeysAndValues.Key>
          <DataKeysAndValues.Value>
            {`${(endedAt.getTime() - startedAt.getTime()).toLocaleString()}ms`}
          </DataKeysAndValues.Value>
        </>
      )}
      {startedAt && (
        <>
          <DataKeysAndValues.Key>Started at</DataKeysAndValues.Key>
          <DataKeysAndValues.Value>{format(startedAt, 'MMM dd, h:mm:ss.SSS aaa')}</DataKeysAndValues.Value>
        </>
      )}
      {endedAt && (
        <>
          <DataKeysAndValues.Key>Ended at</DataKeysAndValues.Key>
          <DataKeysAndValues.Value>{format(endedAt, 'MMM dd, h:mm:ss.SSS aaa')}</DataKeysAndValues.Value>
        </>
      )}
      {usage && (
        <>
          <DataKeysAndValues.Key>Trace input tokens</DataKeysAndValues.Key>
          <DataKeysAndValues.Value>
            {usage.inputTokens === undefined ? '—' : formatCompact(usage.inputTokens)}
          </DataKeysAndValues.Value>
          <DataKeysAndValues.Key>Trace output tokens</DataKeysAndValues.Key>
          <DataKeysAndValues.Value>
            {usage.outputTokens === undefined ? '—' : formatCompact(usage.outputTokens)}
          </DataKeysAndValues.Value>
          <DataKeysAndValues.Key>Trace est. cost</DataKeysAndValues.Key>
          <DataKeysAndValues.Value>
            {usage.estimatedCost === undefined ? '—' : formatCost(usage.estimatedCost, usage.costUnit)}
          </DataKeysAndValues.Value>
        </>
      )}
    </DataKeysAndValues>
  );
}
