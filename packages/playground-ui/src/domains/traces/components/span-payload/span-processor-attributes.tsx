import { describeProcessorPipeline } from '@mastra/core/observability';
import type { ProcessorPipelineDescription } from '@mastra/core/observability';
import { Fragment } from 'react';
import type { SpanRecord } from '../../types';
import { SpanPayloadJson } from './span-payload-json';
import { SpanPayloadCollapsible, SpanPayloadField } from './span-payload-primitives';
import { asCoreSpan } from './span-payload-registry';
import { Badge } from '@/ds/components/Badge';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';

/** Mutation kinds as actions a reader recognises. */
const MUTATION_LABELS: Record<string, string> = {
  add: 'Added messages',
  addSystem: 'Added system message',
  removeByIds: 'Removed messages',
  clear: 'Cleared messages',
};

const formatDuration = (ms: number): string => (ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`);

function Mutations({ mutations }: { mutations: NonNullable<ProcessorPipelineDescription['messageListMutations']> }) {
  return (
    <ul data-slot="span-processor-mutations" className="flex flex-col gap-1.5">
      {mutations.map((mutation, index) => {
        const detail = [
          mutation.source,
          mutation.tag,
          mutation.count !== undefined ? `${mutation.count} message${mutation.count === 1 ? '' : 's'}` : undefined,
          mutation.ids?.length ? `${mutation.ids.length} id${mutation.ids.length === 1 ? '' : 's'}` : undefined,
        ]
          .filter(Boolean)
          .join(' · ');

        return (
          <li key={index} className="text-body text-foreground flex flex-wrap items-center gap-2">
            <span>{MUTATION_LABELS[mutation.type] ?? mutation.type}</span>
            {detail && <span className="text-meta text-placeholder">{detail}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export interface SpanProcessorAttributesProps {
  span: SpanRecord;
}

/**
 * The runner-owned attributes of a processor span, as labelled values.
 *
 * Which keys are "known" is decided by `describeProcessorPipeline` in core, so
 * the JSON block below only ever holds what this view did not explain — the
 * same value never appears in both.
 */
export function SpanProcessorAttributes({ span }: SpanProcessorAttributesProps) {
  const pipeline = describeProcessorPipeline(asCoreSpan(span));
  if (!pipeline) return null;

  const { phaseLabel, executor, processorIndex, hookDurationMs, messageListMutations, tripwireAbort, rest } = pipeline;

  return (
    <div data-slot="span-processor-attributes" className="flex flex-col gap-6">
      <DataKeysAndValues>
        <Fragment>
          <DataKeysAndValues.Key>Phase</DataKeysAndValues.Key>
          <DataKeysAndValues.Value>{phaseLabel}</DataKeysAndValues.Value>
        </Fragment>
        {executor && (
          <Fragment>
            <DataKeysAndValues.Key>Executor</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>{executor === 'workflow' ? 'Workflow' : 'Legacy'}</DataKeysAndValues.Value>
          </Fragment>
        )}
        {processorIndex !== undefined && (
          <Fragment>
            <DataKeysAndValues.Key>Pipeline position</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>{processorIndex + 1}</DataKeysAndValues.Value>
          </Fragment>
        )}
        {hookDurationMs !== undefined && (
          <Fragment>
            <DataKeysAndValues.Key>Hook duration</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>{formatDuration(hookDurationMs)}</DataKeysAndValues.Value>
          </Fragment>
        )}
      </DataKeysAndValues>

      {tripwireAbort && (
        <SpanPayloadField label="Tripwire">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="red">Run blocked</Badge>
              {tripwireAbort.retry !== undefined && (
                <span className="text-meta text-placeholder">
                  {tripwireAbort.retry ? 'Retry requested' : 'No retry'}
                </span>
              )}
            </div>
            {tripwireAbort.reason && <span className="text-body text-foreground">{tripwireAbort.reason}</span>}
            {tripwireAbort.metadata !== undefined && (
              <SpanPayloadCollapsible label="Tripwire metadata">
                <SpanPayloadJson value={tripwireAbort.metadata} />
              </SpanPayloadCollapsible>
            )}
          </div>
        </SpanPayloadField>
      )}

      {messageListMutations && messageListMutations.length > 0 && (
        <SpanPayloadField label="Message list changes">
          <Mutations mutations={messageListMutations} />
        </SpanPayloadField>
      )}

      {rest && (
        <SpanPayloadCollapsible label="Other attributes">
          <SpanPayloadJson value={rest} />
        </SpanPayloadCollapsible>
      )}
    </div>
  );
}
