import { describeProcessorPipeline, describeSpanInput } from '@mastra/core/observability';
import type { ProcessorPipelineDescription } from '@mastra/core/observability';
import { Fragment } from 'react';
import type { SpanRecord } from '../../types';
import { SpanPayloadJson } from './span-payload-json';
import { SpanPayloadMessages } from './span-payload-messages';
import { SpanPayloadCollapsible, SpanPayloadField } from './span-payload-primitives';
import { asCoreSpan, getProcessorRunContext } from './span-payload-registry';
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

type Mutation = NonNullable<ProcessorPipelineDescription['messageListMutations']>[number];

const describeMutation = (mutation: Pick<Mutation, 'source' | 'tag' | 'count'>) =>
  [
    mutation.source,
    mutation.tag,
    mutation.count !== undefined ? `${mutation.count} message${mutation.count === 1 ? '' : 's'}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * Splits the mutation log: changes that only carry a count are added up per
 * type, source and tag into one row each; changes carrying a message, removed
 * ids, or an unreadable entry keep their own detailed item.
 */
function groupMutations(mutations: readonly Mutation[]) {
  const rows = new Map<string, { label: string; source?: string; tag?: string; count?: number }>();
  const detailed: Mutation[] = [];

  for (const mutation of mutations) {
    if (typeof mutation !== 'object' || mutation === null) {
      detailed.push(mutation);
      continue;
    }
    if (mutation.message !== undefined || (mutation.ids && mutation.ids.length > 0)) {
      detailed.push(mutation);
      continue;
    }
    const key = JSON.stringify([mutation.type, mutation.source, mutation.tag]);
    const row = rows.get(key);
    if (row) {
      row.count = row.count === undefined || mutation.count === undefined ? undefined : row.count + mutation.count;
    } else {
      rows.set(key, {
        label: MUTATION_LABELS[mutation.type] ?? mutation.type,
        source: mutation.source,
        tag: mutation.tag,
        count: mutation.count,
      });
    }
  }

  return { rows: [...rows.values()], detailed };
}

function Mutations({ mutations }: { mutations: readonly Mutation[] }) {
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
        const detail = describeMutation(mutation);

        return (
          <li key={index} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Txt tone="ink" as="span" variant="body">
                {MUTATION_LABELS[mutation.type] ?? mutation.type}
              </Txt>
              {detail && (
                <Txt as="span" variant="meta" tone="faint">
                  {detail}
                </Txt>
              )}
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
  const input = describeSpanInput(asCoreSpan(span));
  const { stepNumber, retryCount, messageId } = input?.type === 'processor' ? getProcessorRunContext(input.value) : {};
  const processorName = span.entityName ?? span.entityId;
  const hookDuration = hookDurationMs === undefined ? undefined : formatDuration(hookDurationMs);
  const mutations = groupMutations(messageListMutations ?? []);

  return (
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
        {stepNumber !== undefined && (
          <>
            <DataKeysAndValues.Key>Step</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>{stepNumber}</DataKeysAndValues.Value>
          </>
        )}
        {retryCount !== undefined && (
          <>
            <DataKeysAndValues.Key>Retries</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>{retryCount}</DataKeysAndValues.Value>
          </>
        )}
        {messageId !== undefined && (
          <>
            <DataKeysAndValues.Key>Assistant message id</DataKeysAndValues.Key>
            <DataKeysAndValues.ValueWithCopyBtn copyValue={messageId} copyTooltip="Copy assistant message id">
              {messageId.slice(0, 6)}
            </DataKeysAndValues.ValueWithCopyBtn>
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
        {mutations.rows.map(row => (
          <Fragment key={JSON.stringify([row.label, row.source, row.tag])}>
            <DataKeysAndValues.Key>{row.label}</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>{describeMutation(row)}</DataKeysAndValues.Value>
          </Fragment>
        ))}
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

      {mutations.detailed.length > 0 && (
        <SpanPayloadField label="Message list changes">
          <Mutations mutations={mutations.detailed} />
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
