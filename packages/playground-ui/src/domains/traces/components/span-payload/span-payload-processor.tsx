import type {
  ProcessorRunInputByPhase,
  ProcessorRunOutputByPhase,
  ProcessorSpanPayload,
  SpanInputMessage,
} from '@mastra/core/observability';
import { Fragment } from 'react';
import { SpanPayloadJson } from './span-payload-json';
import { SpanPayloadMessages } from './span-payload-messages';
import {
  SpanPayloadCollapsible,
  SpanPayloadField,
  SpanPayloadMarkdown,
  SpanPayloadToolCalls,
} from './span-payload-primitives';
import { hasItems } from './span-payload-registry';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';

type Scalar = string | number | boolean;

const isScalar = (value: unknown): value is Scalar =>
  typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Message renderers read each message defensively, so any array is a valid list. */
const isMessageList = (value: unknown): value is SpanInputMessage[] => Array.isArray(value);

const listOf = (value: unknown): SpanInputMessage[] => (isMessageList(value) ? value : []);

const isEmptyList = (value: unknown) => Array.isArray(value) && value.length === 0;

/** Single-line values, shown as labelled rows. Ids get a copy button. */
const SCALAR_FIELDS = [
  { key: 'toolName', label: 'Tool' },
  { key: 'toolCallId', label: 'Tool call id', copy: true },
  { key: 'stepNumber', label: 'Step' },
  { key: 'finishReason', label: 'Finish reason' },
  { key: 'totalChunks', label: 'Chunks' },
  { key: 'chunkCount', label: 'Chunks' },
  { key: 'retryCount', label: 'Retries' },
  { key: 'messageId', label: 'Message id', copy: true },
  { key: 'fromCache', label: 'From cache' },
  { key: 'providerExecuted', label: 'Provider executed' },
] as const;

/** Large secondary context, collapsed because it is rarely why someone opened the span. */
const CONTEXT_FIELDS = [
  { key: 'prompt', label: 'Prompt' },
  { key: 'result', label: 'Result' },
  { key: 'model', label: 'Model' },
  { key: 'tools', label: 'Tools' },
  { key: 'toolChoice', label: 'Tool choice' },
  { key: 'activeTools', label: 'Active tools' },
] as const;

/**
 * Whether the preview places a known key. A known key holding a value of the
 * wrong shape is not placed, so it reaches the reader under "Other fields".
 */
const PLACES: Record<string, (value: unknown) => boolean> = {
  messages: Array.isArray,
  systemMessages: Array.isArray,
  toolCalls: Array.isArray,
  text: value => typeof value === 'string',
  accumulatedText: value => typeof value === 'string',
  error: value => typeof value === 'string',
  ...Object.fromEntries(SCALAR_FIELDS.map(({ key }) => [key, isScalar])),
  ...Object.fromEntries(CONTEXT_FIELDS.map(({ key }) => [key, (value: unknown) => value !== undefined])),
};

const formatScalar = (value: Scalar): string => (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value));

const withCount = (label: string, value: unknown) => (Array.isArray(value) ? `${label} (${value.length})` : label);

export interface SpanPayloadProcessorProps {
  value: ProcessorSpanPayload<ProcessorRunInputByPhase> | ProcessorSpanPayload<ProcessorRunOutputByPhase>;
}

/**
 * A processor span's input or output. One renderer serves every phase: the
 * phases share most keys, and each payload carries only the ones its phase
 * records. The phase itself is shown once, in the Attributes preview.
 */
export function SpanPayloadProcessor({ value }: SpanPayloadProcessorProps) {
  const data: Record<string, unknown> = { ...value.data };
  const messages = [...listOf(data.systemMessages), ...listOf(data.messages)];
  const texts = [data.text, data.accumulatedText].filter(isText);
  const scalars = SCALAR_FIELDS.filter(({ key }) => isScalar(data[key]));
  const context = CONTEXT_FIELDS.filter(({ key }) => data[key] !== undefined && !isEmptyList(data[key]));
  const extras = Object.fromEntries(Object.entries(data).filter(([key, field]) => !PLACES[key]?.(field)));
  const hasExtras = Object.keys(extras).length > 0;

  const hasContent =
    messages.length > 0 ||
    hasItems(data.toolCalls) ||
    texts.length > 0 ||
    isText(data.error) ||
    scalars.length > 0 ||
    context.length > 0 ||
    hasExtras;

  return (
    <div data-slot="span-payload-processor" data-phase={value.phase} className="flex flex-col gap-3">
      {!hasContent && <SpanPayloadJson value={data} />}
      {messages.length > 0 && <SpanPayloadMessages value={messages} />}
      {hasItems(data.toolCalls) && (
        <SpanPayloadField label={`Tool calls (${data.toolCalls.length})`}>
          <SpanPayloadToolCalls toolCalls={data.toolCalls} />
        </SpanPayloadField>
      )}
      {texts.map((text, index) => (
        <SpanPayloadMarkdown key={index}>{text}</SpanPayloadMarkdown>
      ))}
      {isText(data.error) && (
        <SpanPayloadField label="Error">
          <SpanPayloadMarkdown>{data.error}</SpanPayloadMarkdown>
        </SpanPayloadField>
      )}
      {scalars.length > 0 && (
        <DataKeysAndValues>
          {scalars.map(field => {
            const scalar = data[field.key];
            if (!isScalar(scalar)) return null;
            return (
              <Fragment key={field.key}>
                <DataKeysAndValues.Key>{field.label}</DataKeysAndValues.Key>
                {'copy' in field ? (
                  <DataKeysAndValues.ValueWithCopyBtn copyValue={String(scalar)}>
                    {formatScalar(scalar)}
                  </DataKeysAndValues.ValueWithCopyBtn>
                ) : (
                  <DataKeysAndValues.Value>{formatScalar(scalar)}</DataKeysAndValues.Value>
                )}
              </Fragment>
            );
          })}
        </DataKeysAndValues>
      )}
      {context.map(({ key, label }) => (
        <SpanPayloadCollapsible key={key} label={withCount(label, data[key])}>
          <SpanPayloadJson value={data[key]} />
        </SpanPayloadCollapsible>
      ))}
      {hasExtras && (
        <SpanPayloadCollapsible label="Other fields">
          <SpanPayloadJson value={extras} />
        </SpanPayloadCollapsible>
      )}
    </div>
  );
}
