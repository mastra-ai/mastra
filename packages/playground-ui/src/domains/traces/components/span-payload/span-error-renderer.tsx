import { describeSpanError } from '@mastra/core/observability';
import type { SpanRecord } from '../../types';
import { SpanPayloadJson } from './span-payload-json';
import { SpanPayloadCollapsible } from './span-payload-primitives';
import { asCoreSpan } from './span-payload-registry';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { Notice } from '@/ds/components/Notice';

export interface SpanErrorRendererProps {
  span: SpanRecord;
  className?: string;
}

/** The error a span recorded, as a banner; `null` when the span succeeded. */
export function SpanErrorRenderer({ span, className }: SpanErrorRendererProps) {
  const error = describeSpanError(asCoreSpan(span));
  if (!error) return null;

  const hasMeta = error.id !== undefined || error.domain !== undefined || error.category !== undefined;

  return (
    <div data-slot="span-error" className={className}>
      <Notice variant="destructive" title={error.name ?? 'Error'}>
        <Notice.Message>{error.message}</Notice.Message>
        {hasMeta && (
          <DataKeysAndValues>
            {error.id !== undefined && (
              <>
                <DataKeysAndValues.Key>Id</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>{error.id}</DataKeysAndValues.Value>
              </>
            )}
            {error.domain !== undefined && (
              <>
                <DataKeysAndValues.Key>Domain</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>{error.domain}</DataKeysAndValues.Value>
              </>
            )}
            {error.category !== undefined && (
              <>
                <DataKeysAndValues.Key>Category</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>{error.category}</DataKeysAndValues.Value>
              </>
            )}
          </DataKeysAndValues>
        )}
        {error.details !== undefined && (
          <SpanPayloadCollapsible label="Details">
            <SpanPayloadJson value={error.details} />
          </SpanPayloadCollapsible>
        )}
      </Notice>
    </div>
  );
}
