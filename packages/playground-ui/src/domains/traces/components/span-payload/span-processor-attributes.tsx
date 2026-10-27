import { describeProcessorPipeline, describeSpanInput } from '@mastra/core/observability';
import type { ProcessorPipelineDescription } from '@mastra/core/observability';
import type { SpanRecord } from '../../types';
import { getSpanChanges } from '../span-outcome.utils';
import { SpanPayloadJson } from './span-payload-json';
import { SpanPayloadMessages } from './span-payload-messages';
import { SpanPayloadCollapsible, SpanPayloadField } from './span-payload-primitives';
import { asCoreSpan, getProcessorRunContext } from './span-payload-registry';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt/Txt';
import { pluralize } from '@/lib/string';
import { formatDuration } from '@/utils/duration';

type Mutation = NonNullable<ProcessorPipelineDescription['messageListMutations']>[number];

const messages = (count: number | undefined) => (count === undefined ? 'messages' : pluralize(count, 'message'));

/** What a recorded change did to the message list, as one sentence. */
function describeMutation(mutation: Exclude<Mutation, null | undefined>): string {
  const { type, source, count, tag } = mutation;
  switch (type) {
    case 'add':
      if (source === 'memory') return `Added ${messages(count)} from memory to the conversation`;
      if (source === 'input') return `Added ${messages(count)} to this turn's input`;
      if (source === 'response') return `Added ${messages(count)} to the model's response`;
      if (source === 'context') return `Added ${messages(count)} of context to the conversation`;
      if (source === 'system') return `Added ${messages(count)} to the system prompt`;
      return `Added ${messages(count)} to the conversation`;
    case 'addSystem':
      return `Added ${count && count > 1 ? messages(count) : 'a'}${tag ? ` "${tag}"` : ''}${count && count > 1 ? '' : ' message'} to the system prompt`;
    case 'clear':
      if (source === 'input') return `Took ${messages(count)} from this turn's input out of the conversation`;
      if (source === 'response') return `Took ${messages(count)} from the model's response out of the conversation`;
      return `Cleared the whole conversation (${messages(count)})`;
    case 'removeByIds':
      if (source === 'system') return `Removed ${messages(count ?? mutation.ids?.length)} from the system prompt`;
      return `Removed ${messages(count ?? mutation.ids?.length)} from the conversation`;
    default:
      return `${String(type)}${source ? ` (${source})` : ''}`;
  }
}

/**
 * The recorded changes in the order they happened. Back-to-back changes of the same
 * kind that only carry a count (e.g. two single-message adds from memory) read as one step.
 */
function toSteps(mutations: readonly Mutation[]) {
  const steps: Mutation[] = [];
  for (const mutation of mutations) {
    const previous = steps.at(-1);
    if (isCountOnly(previous) && isCountOnly(mutation) && isSameKind(previous, mutation)) {
      steps[steps.length - 1] = { ...previous, count: previous.count + mutation.count };
      continue;
    }
    steps.push(mutation);
  }
  return steps;
}

type CountOnlyMutation = Exclude<Mutation, null | undefined> & { count: number };

const isCountOnly = (mutation: Mutation | undefined): mutation is CountOnlyMutation =>
  typeof mutation === 'object' &&
  mutation !== null &&
  mutation.count !== undefined &&
  mutation.message === undefined &&
  !(mutation.ids && mutation.ids.length > 0);

const isSameKind = (a: CountOnlyMutation, b: CountOnlyMutation) =>
  a.type === b.type && a.source === b.source && a.tag === b.tag;

function MutationSteps({ mutations }: { mutations: readonly Mutation[] }) {
  return (
    <ol data-slot="span-processor-mutations" className="flex list-none flex-col divide-y divide-border">
      {toSteps(mutations).map((mutation, index) => (
        <li key={index} className="flex gap-3 py-3 first:pt-0 last:pb-0">
          <Txt as="span" variant="body-sm" tone="faint" font="mono" className="tabular-nums">
            {index + 1}.
          </Txt>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {typeof mutation === 'object' && mutation !== null ? (
              <>
                {/* An added message speaks for itself; anything else needs saying what happened to it. */}
                {(mutation.message === undefined || mutation.type === 'removeByIds') && (
                  <Txt as="p" variant="body-sm" tone="ink" data-slot="span-processor-mutation-step">
                    {describeMutation(mutation)}
                  </Txt>
                )}
                {mutation.message !== undefined && <SpanPayloadMessages value={[mutation.message]} />}
                {mutation.ids && mutation.ids.length > 0 && (
                  <SpanPayloadCollapsible label={`Removed ids (${mutation.ids.length})`}>
                    <SpanPayloadJson value={mutation.ids} />
                  </SpanPayloadCollapsible>
                )}
              </>
            ) : (
              <SpanPayloadJson value={mutation} />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export interface SpanProcessorAttributesProps {
  span: SpanRecord;
  /** Leave the message list changes out, when the span outcome already shows them. */
  hideMutations?: boolean;
}

/** What a pipeline span changed in the message list, step by step; `null` when it changed nothing. */
export function SpanProcessorMutations({ span }: { span: SpanRecord }) {
  const mutations = getSpanChanges(span);
  if (mutations.length === 0) return null;

  return (
    <div data-slot="span-processor-changes">
      <MutationSteps mutations={mutations} />
    </div>
  );
}

/**
 * The runner-owned attributes of a processor span, as labelled values.
 * `describeProcessorPipeline` decides which keys are known, so "Other attributes"
 * holds only what this view does not show.
 */
export function SpanProcessorAttributes({ span, hideMutations = false }: SpanProcessorAttributesProps) {
  const pipeline = describeProcessorPipeline(asCoreSpan(span));
  if (!pipeline) return null;

  const { phaseLabel, executor, processorIndex, hookDurationMs, messageListMutations, tripwireAbort, rest } = pipeline;
  const input = describeSpanInput(asCoreSpan(span));
  const { stepNumber, retryCount, messageId } = input?.type === 'processor' ? getProcessorRunContext(input.value) : {};
  const processorName = span.entityName ?? span.entityId;
  const hookDuration = hookDurationMs === undefined ? undefined : formatDuration(hookDurationMs);
  const mutations = hideMutations ? [] : (messageListMutations ?? []);

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

      {mutations.length > 0 && (
        <SpanPayloadField label="Message list changes">
          <MutationSteps mutations={mutations} />
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
