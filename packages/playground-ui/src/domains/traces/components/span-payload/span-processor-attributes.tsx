import { describeProcessorPipeline } from '@mastra/core/observability';
import type { ReactNode } from 'react';
import type { SpanRecord } from '../../types';
import { asCoreSpan } from './span-payload-registry';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { Txt } from '@/ds/components/Txt/Txt';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/utils/duration';

export interface SpanProcessorAttributesProps {
  span: SpanRecord;
  className?: string;
}

/**
 * Where a processor ran in the pipeline, and the tripwire that stopped the run, as labelled values.
 * Renders nothing for a span with no recorded phase.
 */
export function SpanProcessorAttributes({ span, className }: SpanProcessorAttributesProps) {
  const pipeline = describeProcessorPipeline(asCoreSpan(span));
  if (!pipeline) return null;

  const { phaseLabel, executor, processorIndex, hookDurationMs, tripwireAbort } = pipeline;
  const processorName = span.entityName ?? span.entityId;

  return (
    <div data-slot="span-processor-attributes" className={className}>
      <DataKeysAndValues>
        {processorName && <Row label="Processor">{processorName}</Row>}
        <Row label="Phase">{phaseLabel}</Row>
        {executor && <Row label="Executor">{executor === 'workflow' ? 'Workflow' : 'Legacy'}</Row>}
        {/* processorIndex is 0-based; the position reads 1-based. */}
        {processorIndex !== undefined && <Row label="Pipeline position">{processorIndex + 1}</Row>}
        {hookDurationMs !== undefined && <Row label="Hook duration">{formatDuration(hookDurationMs)}</Row>}
        {tripwireAbort?.reason && (
          <Row label="Tripwire" wrap>
            {tripwireAbort.reason}
          </Row>
        )}
        {tripwireAbort?.retry !== undefined && <Row label="Retry">{tripwireAbort.retry ? 'Yes' : 'No'}</Row>}
        {tripwireAbort?.metadata !== undefined && (
          <Row label="Tripwire metadata" wrap>
            <Txt as="span" variant="body-sm" font="mono" className="break-all">
              {JSON.stringify(tripwireAbort.metadata)}
            </Txt>
          </Row>
        )}
      </DataKeysAndValues>
    </div>
  );
}

function Row({ label, wrap, children }: { label: string; wrap?: boolean; children: ReactNode }) {
  return (
    <>
      <DataKeysAndValues.Key>{label}</DataKeysAndValues.Key>
      <DataKeysAndValues.Value className={cn(wrap && 'break-words whitespace-pre-wrap')}>
        {children}
      </DataKeysAndValues.Value>
    </>
  );
}
