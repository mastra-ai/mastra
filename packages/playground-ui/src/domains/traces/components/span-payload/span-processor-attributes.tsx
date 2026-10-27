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
import { pluralize } from '@/lib/string';
import { formatDuration } from '@/utils/duration';

/** Mutation kinds, named by where the change landed in what the model reads. */
const MUTATION_LABELS: Record<string, string> = {
  add: 'Added to the conversation',
  addSystem: 'Added to the system prompt',
  removeByIds: 'Removed from the conversation',
  clear: 'Cleared the conversation',
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

/** One sentence per kind of change, stated once above the entries it covers. */
const MUTATION_HEADINGS: Record<string, (count: number) => string> = {
  add: count => `Added ${pluralize(count, 'message')} to the conversation`,
  addSystem: count => `Added ${pluralize(count, 'message')} to the system prompt`,
  removeByIds: () => 'Removed from the conversation',
  clear: () => 'Cleared the conversation',
};

/** Groups detailed changes by kind, in the order each kind first appears. */
function groupByKind(mutations: readonly Mutation[]) {
  const groups = new Map<string, Mutation[]>();
  for (const mutation of mutations) {
    const kind = typeof mutation === 'object' && mutation !== null ? mutation.type : 'unreadable';
    groups.set(kind, [...(groups.get(kind) ?? []), mutation]);
  }
  return [...groups.entries()];
}

function Mutations({ mutations }: { mutations: readonly Mutation[] }) {
  return (
    <div data-slot="span-processor-mutations" className="flex flex-col gap-4">
      {groupByKind(mutations).map(([kind, entries]) => (
        <section key={kind} className="flex flex-col gap-2">
          <Txt as="h4" variant="body-sm" tone="ink" className="font-medium">
            {MUTATION_HEADINGS[kind]?.(entries.length) ?? kind}
          </Txt>
          <ol className="flex flex-col divide-y divide-border">
            {entries.map((mutation, index) => {
              if (typeof mutation !== 'object' || mutation === null) {
                return (
                  <li key={index} className="py-3 first:pt-0 last:pb-0">
                    <SpanPayloadJson value={mutation} />
                  </li>
                );
              }
              const context = describeMutation(mutation);
              return (
                <li key={index} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  {context && (
                    <Txt as="span" variant="meta" tone="muted">
                      {context}
                    </Txt>
                  )}
                  {mutation.message !== undefined && <SpanPayloadMessages value={[mutation.message]} />}
                  {mutation.ids && mutation.ids.length > 0 && (
                    <SpanPayloadCollapsible label={`Removed ids (${mutation.ids.length})`}>
                      <SpanPayloadJson value={mutation.ids} />
                    </SpanPayloadCollapsible>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

export interface SpanProcessorAttributesProps {
  span: SpanRecord;
  /** Leave the message list changes out, when the span outcome already shows them. */
  hideMutations?: boolean;
}

/** What a pipeline span changed in the message list; `null` when it changed nothing. */
export function SpanProcessorMutations({ span }: { span: SpanRecord }) {
  const mutations = groupMutations(describeProcessorPipeline(asCoreSpan(span))?.messageListMutations ?? []);
  if (mutations.rows.length === 0 && mutations.detailed.length === 0) return null;

  return (
    <div data-slot="span-processor-changes" className="flex flex-col gap-3">
      {mutations.rows.length > 0 && (
        <DataKeysAndValues>
          {mutations.rows.map(row => (
            <Fragment key={JSON.stringify([row.label, row.source, row.tag])}>
              <DataKeysAndValues.Key>{row.label}</DataKeysAndValues.Key>
              <DataKeysAndValues.Value>{describeMutation(row)}</DataKeysAndValues.Value>
            </Fragment>
          ))}
        </DataKeysAndValues>
      )}
      {mutations.detailed.length > 0 && <Mutations mutations={mutations.detailed} />}
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
  const mutations = groupMutations(hideMutations ? [] : (messageListMutations ?? []));

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
