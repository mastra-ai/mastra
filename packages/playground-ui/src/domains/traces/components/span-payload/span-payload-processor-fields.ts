import type { SpanInputMessage } from '@mastra/core/observability';

export type Scalar = string | number | boolean;

export const isScalar = (value: unknown): value is Scalar =>
  typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));

export const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Message renderers read each message defensively, so any array is a valid list. */
const listOf = (value: unknown): SpanInputMessage[] => (Array.isArray(value) ? value : []);

const isEmptyList = (value: unknown) => Array.isArray(value) && value.length === 0;

const hasItems = (value: unknown): value is unknown[] => Array.isArray(value) && value.length > 0;

/** Single-line values, shown as labelled rows. Ids get a copy button. */
export const SCALAR_FIELDS = [
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
  prompt: Array.isArray,
  toolCalls: Array.isArray,
  text: value => typeof value === 'string',
  accumulatedText: value => typeof value === 'string',
  error: value => typeof value === 'string',
  ...Object.fromEntries(SCALAR_FIELDS.map(({ key }) => [key, isScalar])),
  ...Object.fromEntries(CONTEXT_FIELDS.map(({ key }) => [key, (value: unknown) => value !== undefined])),
};

/** A processor payload sorted into what the preview formats, and what it leaves under "Other fields". */
export function readProcessorPayload(payload: object, hidden: readonly string[] = []) {
  const data: Record<string, unknown> = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !hidden.includes(key)),
  );
  // `prompt` is what an llmRequest processor gets: the same conversation, in the provider's message format.
  const messages = [...listOf(data.systemMessages), ...listOf(data.messages), ...listOf(data.prompt)];
  const toolCalls = hasItems(data.toolCalls) ? data.toolCalls : [];
  const texts = [data.text, data.accumulatedText].filter(isText);
  const error = isText(data.error) ? data.error : undefined;
  const scalars = SCALAR_FIELDS.filter(({ key }) => isScalar(data[key]));
  const context = CONTEXT_FIELDS.filter(({ key }) => data[key] !== undefined && !isEmptyList(data[key]));
  const extras = Object.fromEntries(Object.entries(data).filter(([key, field]) => !PLACES[key]?.(field)));

  const formatsAny =
    messages.length > 0 ||
    toolCalls.length > 0 ||
    texts.length > 0 ||
    error !== undefined ||
    scalars.length > 0 ||
    context.length > 0;

  return { data, messages, toolCalls, texts, error, scalars, context, extras, formatsAny };
}

/**
 * Whether a processor payload has a preview worth switching to. When the preview formats nothing it
 * would only repeat the raw JSON, so there is nothing to toggle between.
 */
export function hasProcessorPreview(payload: object, hidden: readonly string[] = []): boolean {
  return readProcessorPayload(payload, hidden).formatsAny;
}

/** Keys a processor input preview leaves to the Tools section. */
export function processorInputToolKeys(payload: object): string[] {
  return 'tools' in payload && hasItems(payload.tools) ? ['tools', 'toolChoice'] : [];
}
