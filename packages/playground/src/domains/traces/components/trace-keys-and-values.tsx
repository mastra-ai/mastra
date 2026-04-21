import type { SpanRecord } from '@mastra/core/storage';
import { DataKeysAndValues } from '@mastra/playground-ui';
import { format } from 'date-fns';

export interface TraceKeysAndValuesProps {
  rootSpan: SpanRecord;
  className?: string;
  numOfCol?: 1 | 3;
}

export function TraceKeysAndValues({ rootSpan, className, numOfCol = 1 }: TraceKeysAndValuesProps) {
  const startedAt = rootSpan.startedAt ? new Date(rootSpan.startedAt) : null;
  const endedAt = rootSpan.endedAt ? new Date(rootSpan.endedAt) : null;
  const status = rootSpan.attributes?.status as string | undefined;

  return (
    <DataKeysAndValues numOfCol={numOfCol} className={className}>
      {rootSpan.traceId && (
        <>
          <DataKeysAndValues.Key>Trace Id</DataKeysAndValues.Key>
          <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy Trace Id to clipboard" copyValue={rootSpan.traceId}>
            {rootSpan.traceId}
          </DataKeysAndValues.ValueWithCopyBtn>
        </>
      )}
      {rootSpan.entityId && (
        <>
          <DataKeysAndValues.Key>Primitive Id</DataKeysAndValues.Key>
          <DataKeysAndValues.Value>{rootSpan.entityId}</DataKeysAndValues.Value>
        </>
      )}
      {rootSpan.entityName && (
        <>
          <DataKeysAndValues.Key>Primitive Name</DataKeysAndValues.Key>
          <DataKeysAndValues.Value>{rootSpan.entityName}</DataKeysAndValues.Value>
        </>
      )}
      {rootSpan.entityType && (
        <>
          <DataKeysAndValues.Key>Primitive Type</DataKeysAndValues.Key>
          <DataKeysAndValues.Value>{rootSpan.entityType}</DataKeysAndValues.Value>
        </>
      )}
      <>
        <DataKeysAndValues.Key>Status</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>{status || '-'}</DataKeysAndValues.Value>
      </>
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
      {rootSpan.tags && rootSpan.tags.length > 0 && (
        <>
          <DataKeysAndValues.Key>Tags</DataKeysAndValues.Key>
          <DataKeysAndValues.Value>{rootSpan.tags.join(', ')}</DataKeysAndValues.Value>
        </>
      )}
      {rootSpan.runId && (
        <>
          <DataKeysAndValues.Key>Run Id</DataKeysAndValues.Key>
          <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy Run Id to clipboard" copyValue={rootSpan.runId}>
            {rootSpan.runId}
          </DataKeysAndValues.ValueWithCopyBtn>
        </>
      )}
      {rootSpan.threadId && (
        <>
          <DataKeysAndValues.Key>Thread Id</DataKeysAndValues.Key>
          <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy Thread Id to clipboard" copyValue={rootSpan.threadId}>
            {rootSpan.threadId}
          </DataKeysAndValues.ValueWithCopyBtn>
        </>
      )}
      {rootSpan.sessionId && (
        <>
          <DataKeysAndValues.Key>Session Id</DataKeysAndValues.Key>
          <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy Session Id to clipboard" copyValue={rootSpan.sessionId}>
            {rootSpan.sessionId}
          </DataKeysAndValues.ValueWithCopyBtn>
        </>
      )}
      {rootSpan.requestId && (
        <>
          <DataKeysAndValues.Key>Request Id</DataKeysAndValues.Key>
          <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy Request Id to clipboard" copyValue={rootSpan.requestId}>
            {rootSpan.requestId}
          </DataKeysAndValues.ValueWithCopyBtn>
        </>
      )}
      {rootSpan.resourceId && (
        <>
          <DataKeysAndValues.Key>Resource Id</DataKeysAndValues.Key>
          <DataKeysAndValues.ValueWithCopyBtn
            copyTooltip="Copy Resource Id to clipboard"
            copyValue={rootSpan.resourceId}
          >
            {rootSpan.resourceId}
          </DataKeysAndValues.ValueWithCopyBtn>
        </>
      )}
      {rootSpan.userId && (
        <>
          <DataKeysAndValues.Key>User Id</DataKeysAndValues.Key>
          <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy User Id to clipboard" copyValue={rootSpan.userId}>
            {rootSpan.userId}
          </DataKeysAndValues.ValueWithCopyBtn>
        </>
      )}
      {rootSpan.organizationId && (
        <>
          <DataKeysAndValues.Key>Organization Id</DataKeysAndValues.Key>
          <DataKeysAndValues.ValueWithCopyBtn
            copyTooltip="Copy Organization Id to clipboard"
            copyValue={rootSpan.organizationId}
          >
            {rootSpan.organizationId}
          </DataKeysAndValues.ValueWithCopyBtn>
        </>
      )}
      {rootSpan.experimentId && (
        <>
          <DataKeysAndValues.Key>Experiment Id</DataKeysAndValues.Key>
          <DataKeysAndValues.ValueWithCopyBtn
            copyTooltip="Copy Experiment Id to clipboard"
            copyValue={rootSpan.experimentId}
          >
            {rootSpan.experimentId}
          </DataKeysAndValues.ValueWithCopyBtn>
        </>
      )}
    </DataKeysAndValues>
  );
}
