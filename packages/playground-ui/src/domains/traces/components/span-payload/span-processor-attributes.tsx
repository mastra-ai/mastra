import { describeProcessorPipeline } from '@mastra/core/observability';
import type { ProcessorPipelineDescription } from '@mastra/core/observability';
import type { SpanRecord } from '../../types';
import { SpanPayloadJson } from './span-payload-json';
import { SpanPayloadMessages } from './span-payload-messages';
import { SpanPayloadCollapsible, SpanPayloadField } from './span-payload-primitives';
import { asCoreSpan } from './span-payload-registry';
import { Card, CardContent } from '@/ds/components/Card';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt/Txt';
import { formatDuration } from '@/utils/duration';

/** Mutation kinds as actions a reader recognises. */
const MUTATION_LABELS: Record<string, string> = {
  add: 'Added messages',
  addSystem: 'Added system message',
  removeByIds: 'Removed messages',
  clear: 'Cleared messages',
};

function Mutations({ mutations }: { mutations: NonNullable<ProcessorPipelineDescription['messageListMutations']> }) {
  return (
    <ul data-slot="span-processor-mutations" className="flex flex-col gap-1.5">
      {mutations.map((mutation, index) => {
        if (typeof mutation !== 'object' || mutation === null) {
          return (
            <li key={index}>
              <SpanPayloadJson value={mutation} />
            </li>
          );
        }
        const detail = [
          mutation.source,
          mutation.tag,
          mutation.count !== undefined ? `${mutation.count} message${mutation.count === 1 ? '' : 's'}` : undefined,
        ]
          .filter(Boolean)
          .join(' · ');

        return (
          <li key={index} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-body text-foreground">
              <span>{MUTATION_LABELS[mutation.type] ?? mutation.type}</span>
              {detail && <span className="text-meta text-placeholder">{detail}</span>}
            </div>
            {mutation.message !== undefined && <SpanPayloadMessages value={[mutation.message]} />}
            {mutation.ids && mutation.ids.length > 0 && (
              <SpanPayloadCollapsible label={`Removed ids (${mutation.ids.length})`}>
                <SpanPayloadJson value={mutation.ids} />
              </SpanPayloadCollapsible>
            )}
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
 * `describeProcessorPipeline` decides which keys are known, so "Other attributes"
 * holds only what this view does not show.
 */
export function SpanProcessorAttributes({ span }: SpanProcessorAttributesProps) {
  const pipeline = describeProcessorPipeline(asCoreSpan(span));
  if (!pipeline) return null;

  const { phaseLabel, executor, processorIndex, hookDurationMs, messageListMutations, tripwireAbort, rest } = pipeline;
  const processorName = span.entityName ?? span.entityId;
  const hookDuration = hookDurationMs === undefined ? undefined : formatDuration(hookDurationMs);

  return (
    <Card data-slot="span-processor-attributes-card" className="min-w-0">
      <CardContent>
        <div data-slot="span-processor-attributes" className="flex flex-col gap-3">
          <DataKeysAndValues>
            {processorName && (
              <>
                <DataKeysAndValues.Key>Processor</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>{processorName}</DataKeysAndValues.Value>
              </>
            )}
            <>
              <DataKeysAndValues.Key>Phase</DataKeysAndValues.Key>
              <DataKeysAndValues.Value>{phaseLabel}</DataKeysAndValues.Value>
            </>
            {executor && (
              <>
                <DataKeysAndValues.Key>Executor</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>{executor === 'workflow' ? 'Workflow' : 'Legacy'}</DataKeysAndValues.Value>
              </>
            )}
            {processorIndex !== undefined && (
              <>
                <DataKeysAndValues.Key>Pipeline position</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>{processorIndex + 1}</DataKeysAndValues.Value>
              </>
            )}
            {hookDuration && (
              <>
                <DataKeysAndValues.Key>Hook duration</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>
                  <Txt as="span" variant="body-sm" font="mono">
                    {hookDuration}
                  </Txt>
                </DataKeysAndValues.Value>
              </>
            )}
          </DataKeysAndValues>

          {tripwireAbort && (
            <Notice variant="destructive" title="Tripwire">
              {tripwireAbort.reason && <Notice.Message>{tripwireAbort.reason}</Notice.Message>}
              {tripwireAbort.retry !== undefined && (
                <DataKeysAndValues>
                  <DataKeysAndValues.Key>Retry</DataKeysAndValues.Key>
                  <DataKeysAndValues.Value>{tripwireAbort.retry ? 'Yes' : 'No'}</DataKeysAndValues.Value>
                </DataKeysAndValues>
              )}
              {tripwireAbort.metadata !== undefined && (
                <SpanPayloadCollapsible label="Metadata">
                  <SpanPayloadJson value={tripwireAbort.metadata} />
                </SpanPayloadCollapsible>
              )}
            </Notice>
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
      </CardContent>
    </Card>
  );
}
