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
const MESSAGE_FIELDS = [
  { key: 'messages', label: 'Messages' },
  { key: 'systemMessages', label: 'System messages' },
] as const;

const TEXT_FIELDS = [
  { key: 'text', label: 'Text' },
  { key: 'accumulatedText', label: 'Accumulated text' },
  { key: 'error', label: 'Error' },
] as const;

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

/** Keys rendered above; anything else in the payload falls to the trailing JSON block. */
const RENDERED_KEYS: ReadonlySet<string> = new Set([
  ...MESSAGE_FIELDS.map(field => field.key),
  ...TEXT_FIELDS.map(field => field.key),
  ...SCALAR_FIELDS.map(field => field.key),
  'toolCalls',
  'prompt',
  'result',
  'model',
  'tools',
  'toolChoice',
  'activeTools',
]);

const formatScalar = (value: unknown): string => (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value));

function ScalarRows({ payload }: { payload: Record<string, unknown> }) {
  const rows = SCALAR_FIELDS.filter(field => payload[field.key] !== undefined);
  if (rows.length === 0) return null;

  return (
    <DataKeysAndValues>
      {rows.map(field => (
        <Fragment key={field.key}>
          <DataKeysAndValues.Key>{field.label}</DataKeysAndValues.Key>
          <DataKeysAndValues.Value>{formatScalar(payload[field.key])}</DataKeysAndValues.Value>
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
  const extras = Object.fromEntries(Object.entries(payload).filter(([key]) => !RENDERED_KEYS.has(key)));
  const sections: ReactNode[] = [];

  for (const field of MESSAGE_FIELDS) {
    const messages = payload[field.key];
    if (!Array.isArray(messages)) continue;
    sections.push(
      <SpanPayloadField key={field.key} label={field.label}>
        {messages.length > 0 ? (
          <SpanPayloadMessages value={messages} />
        ) : (
          <span className="text-body text-placeholder">
            {field.key === 'messages' ? 'No messages' : 'No system messages'}
          </span>
        )}
      </SpanPayloadField>,
    );
  }

  if (Array.isArray(payload.toolCalls) && payload.toolCalls.length > 0) {
    sections.push(
      <SpanPayloadField key="toolCalls" label="Tool calls">
        <SpanPayloadToolCalls toolCalls={payload.toolCalls} />
      </SpanPayloadField>,
    );
  }

  for (const field of TEXT_FIELDS) {
    const text = payload[field.key];
    if (typeof text !== 'string' || text.length === 0) continue;
    sections.push(
      <SpanPayloadField key={field.key} label={field.label}>
        <SpanPayloadMarkdown>{text}</SpanPayloadMarkdown>
      </SpanPayloadField>,
    );
  }

  if (SCALAR_FIELDS.some(field => payload[field.key] !== undefined)) {
    sections.push(<ScalarRows key="scalars" payload={payload} />);
  }

  // Secondary context: the prompt a request processor saw, the result an output
  // processor read, and the model-call configuration an input step could change.
  // Collapsed because they are large and rarely the reason someone opened the span.
  for (const key of ['prompt', 'result', 'model', 'tools', 'toolChoice', 'activeTools'] as const) {
    if (payload[key] === undefined) continue;
    sections.push(
      <SpanPayloadCollapsible key={key} label={key === 'activeTools' ? 'Active tools' : key}>
        <SpanPayloadJson value={payload[key]} />
      </SpanPayloadCollapsible>,
    );
  }

  if (Object.keys(extras).length > 0) {
    sections.push(
      <SpanPayloadCollapsible key="extras" label="Other fields">
        <SpanPayloadJson value={extras} />
      </SpanPayloadCollapsible>,
    );
  }

  return (
    <div data-slot="span-payload-processor" data-phase={value.phase} className="flex flex-col gap-6">
      <SpanPayloadField label="Phase">
        <span className="text-body text-foreground">{value.phaseLabel}</span>
      </SpanPayloadField>
      {sections.length > 0 ? sections : <SpanPayloadJson value={payload} />}
    </div>
  );
}
