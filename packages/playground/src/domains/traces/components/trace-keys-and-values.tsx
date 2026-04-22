import { computeTraceStatus, TraceStatus } from '@internal-temp/core/index';
import { DataKeysAndValues } from '@mastra/playground-ui';
import { format } from 'date-fns';

/** Minimal root-span fields needed for the trace header. */
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
  numOfCol?: 1 | 2 | 3;
  className?: string;
}

export function TraceKeysAndValues({ rootSpan, numOfCol = 2, className }: TraceKeysAndValuesProps) {
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
    </DataKeysAndValues>
  );
}
