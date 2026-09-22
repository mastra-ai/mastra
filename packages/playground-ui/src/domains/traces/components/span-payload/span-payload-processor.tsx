import type {
  ProcessorRunInputByPhase,
  ProcessorRunOutputByPhase,
  ProcessorSpanPayload,
} from '@mastra/core/observability';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { SpanPayloadJson } from './span-payload-json';
import { SpanPayloadMessages } from './span-payload-messages';
import {
  SpanPayloadCollapsible,
  SpanPayloadField,
  SpanPayloadMarkdown,
  SpanPayloadToolCalls,
} from './span-payload-primitives';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';

/**
 * Keys a processor payload can hold, in the order they read best: what the
 * processor was working on first, then where in the run it happened.
 *
 * One list rather than a component per phase: the phases share most of their
 * keys, and a payload only ever carries the subset its phase recorded.
 */
const SCALAR_FIELDS = [
  { key: 'toolName', label: 'Tool' },
  { key: 'toolCallId', label: 'Tool call id' },
  { key: 'stepNumber', label: 'Step' },
  { key: 'finishReason', label: 'Finish reason' },
  { key: 'totalChunks', label: 'Chunks' },
  { key: 'chunkCount', label: 'Chunks' },
  { key: 'retryCount', label: 'Retries' },
  { key: 'messageId', label: 'Message id' },
  { key: 'fromCache', label: 'From cache' },
  { key: 'providerExecuted', label: 'Provider executed' },
] as const;

/** Identifiers a reader copies into a search, as the tool-call renderers already allow. */
const COPYABLE_KEYS: ReadonlySet<string> = new Set(['toolCallId', 'messageId']);

/** Large secondary context, collapsed because it is rarely why someone opened the span. */
const CONTEXT_FIELDS = [
  { key: 'prompt', label: 'Prompt' },
  { key: 'result', label: 'Result' },
  { key: 'model', label: 'Model' },
  { key: 'tools', label: 'Tools' },
  { key: 'toolChoice', label: 'Tool choice' },
  { key: 'activeTools', label: 'Active tools' },
] as const;

const hasItems = (value: unknown): value is unknown[] => Array.isArray(value) && value.length > 0;

/** A scalar this view can print as one line; anything else belongs in the JSON block. */
const SCALAR_RENDERABLE = (value: unknown): boolean =>
  typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));

const formatScalar = (value: unknown): string => (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value));

function ScalarRows({
  fields,
  payload,
}: {
  fields: readonly { key: string; label: string }[];
  payload: Record<string, unknown>;
}) {
  return (
    <DataKeysAndValues>
      {fields.map(field => (
        <Fragment key={field.key}>
          <DataKeysAndValues.Key>{field.label}</DataKeysAndValues.Key>
          {COPYABLE_KEYS.has(field.key) ? (
            <DataKeysAndValues.ValueWithCopyBtn copyValue={String(payload[field.key])}>
              {formatScalar(payload[field.key])}
            </DataKeysAndValues.ValueWithCopyBtn>
          ) : (
            <DataKeysAndValues.Value>{formatScalar(payload[field.key])}</DataKeysAndValues.Value>
          )}
        </Fragment>
      ))}
    </DataKeysAndValues>
  );
}

export interface SpanPayloadProcessorProps {
  value: ProcessorSpanPayload<ProcessorRunInputByPhase> | ProcessorSpanPayload<ProcessorRunOutputByPhase>;
}

/**
 * A processor span's input or output, laid out by what the payload holds.
 *
 * The phase comes from the span's attributes, so nothing here sniffs shapes to
 * decide what it is looking at. Unrecognised keys still reach the reader
 * through the JSON block at the end rather than being dropped.
 */
export function SpanPayloadProcessor({ value }: SpanPayloadProcessorProps) {
  const payload: Record<string, unknown> = { ...value.data };
  const sections: ReactNode[] = [];
  // Keys this render actually laid out. Whatever is left over goes to the JSON
  // block below, so a known key holding an unexpected value is still shown
  // rather than silently dropped.
  const laidOut = new Set<string>();

  // One message list, as the agent and model renderers show it: each bubble's
  // role tag already says which messages are system messages.
  const systemMessages = payload.systemMessages;
  const messages = payload.messages;
  if (Array.isArray(systemMessages)) laidOut.add('systemMessages');
  if (Array.isArray(messages)) laidOut.add('messages');
  const allMessages = [
    ...(Array.isArray(systemMessages) ? systemMessages : []),
    ...(Array.isArray(messages) ? messages : []),
  ];
  if (allMessages.length > 0) sections.push(<SpanPayloadMessages key="messages" value={allMessages} />);

  if (hasItems(payload.toolCalls)) {
    laidOut.add('toolCalls');
    sections.push(
      <SpanPayloadField key="toolCalls" label={`Tool calls (${payload.toolCalls.length})`}>
        <SpanPayloadToolCalls toolCalls={payload.toolCalls} />
      </SpanPayloadField>,
    );
  }

  for (const key of ['text', 'accumulatedText'] as const) {
    const text = payload[key];
    if (typeof text !== 'string' || text.length === 0) continue;
    laidOut.add(key);
    sections.push(<SpanPayloadMarkdown key={key}>{text}</SpanPayloadMarkdown>);
  }

  if (typeof payload.error === 'string' && payload.error.length > 0) {
    laidOut.add('error');
    sections.push(
      <SpanPayloadField key="error" label="Error">
        <SpanPayloadMarkdown>{payload.error}</SpanPayloadMarkdown>
      </SpanPayloadField>,
    );
  }

  const scalars = SCALAR_FIELDS.filter(field => SCALAR_RENDERABLE(payload[field.key]));
  if (scalars.length > 0) {
    for (const field of scalars) laidOut.add(field.key);
    sections.push(<ScalarRows key="scalars" fields={scalars} payload={payload} />);
  }

  // The prompt a request processor saw, the result an output processor read, and
  // the model-call configuration an input step could change.
  for (const { key, label } of CONTEXT_FIELDS) {
    if (payload[key] === undefined) continue;
    laidOut.add(key);
    // Empty lists are left out, as the other span renderers leave them out.
    if (Array.isArray(payload[key]) && payload[key].length === 0) continue;
    sections.push(
      <SpanPayloadCollapsible
        key={key}
        label={Array.isArray(payload[key]) ? `${label} (${(payload[key] as unknown[]).length})` : label}
      >
        <SpanPayloadJson value={payload[key]} />
      </SpanPayloadCollapsible>,
    );
  }

  const extras = Object.fromEntries(Object.entries(payload).filter(([key]) => !laidOut.has(key)));
  if (Object.keys(extras).length > 0) {
    sections.push(
      <SpanPayloadCollapsible key="extras" label="Other fields">
        <SpanPayloadJson value={extras} />
      </SpanPayloadCollapsible>,
    );
  }

  // The phase itself is shown once, in the Attributes preview. A payload with
  // nothing to lay out stays JSON, as any other span's would.
  return (
    <div data-slot="span-payload-processor" data-phase={value.phase} className="flex flex-col gap-6">
      {sections.length > 0 ? sections : <SpanPayloadJson value={payload} />}
    </div>
  );
}
