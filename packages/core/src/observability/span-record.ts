import type { MessageListItem } from '../agent/message-list/types';
import type { SpanRecord } from '../storage/domains/observability/tracing';
import type {
  AgentRunResult,
  AgentRunResumeInput,
  InterruptedSpanOutput,
  ModelGenerationResult,
  ModelStepMessage,
  ModelStepResult,
  SpanErrorInfo,
} from './types';
import { SpanType } from './types';

/**
 * Narrows a stored span record to one or more span types, typing its
 * `attributes`, `input` and `output` for that type.
 *
 * The check is on `spanType` only. Payloads are not validated: the typed view
 * trusts that the producer for that span type wrote the shape core declares,
 * the same trust `SpanTypeMap` already places in `attributes`.
 *
 * This module imports only the `SpanType` enum at runtime, so browser bundles
 * that need these helpers do not pull in the rest of the observability
 * utilities.
 *
 * @example
 * if (isSpanRecordOfType(span, SpanType.MODEL_GENERATION)) {
 *   span.attributes?.usage; // UsageStats | undefined
 * }
 */
export function isSpanRecordOfType<TType extends SpanType>(
  span: SpanRecord,
  type: TType | readonly TType[],
): span is SpanRecord<TType> {
  return Array.isArray(type) ? type.includes(span.spanType as TType) : span.spanType === type;
}

/** A message as it appears in a span input: a caller message, or the shallow preview a model step records. */
export type SpanInputMessage = MessageListItem | ModelStepMessage;

/**
 * A span's `input`, tagged by what it holds so a renderer can switch on `type`.
 * The tag is derived at read time from `spanType` and the value's shape; it is
 * never stored.
 */
export type SpanInputDescription =
  | { type: 'text'; value: string }
  | { type: 'messages'; value: SpanInputMessage[] }
  | { type: 'agent-run-resume'; value: AgentRunResumeInput }
  | { type: 'json'; value: unknown };

/** A span's `output`, tagged by what it holds so a renderer can switch on `type`. */
export type SpanOutputDescription =
  | { type: 'interrupted'; value: InterruptedSpanOutput }
  | { type: 'agent-run-result'; value: AgentRunResult }
  | { type: 'model-generation-result'; value: ModelGenerationResult }
  | { type: 'model-step-result'; value: ModelStepResult }
  | { type: 'text'; value: string }
  | { type: 'json'; value: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isInterrupted = (value: Record<string, unknown>): value is Record<string, unknown> & InterruptedSpanOutput =>
  value.status === 'suspended' || value.status === 'aborted';

/** Span types whose `input` is a message list when it is an array. */
const MESSAGE_LIST_INPUT_SPANS: readonly SpanType[] = [
  SpanType.AGENT_RUN,
  SpanType.MODEL_STEP,
  SpanType.MODEL_INFERENCE,
];

/**
 * Describes a stored span's `input` for rendering: the value tagged by what it
 * holds. Returns `undefined` when the span recorded no input.
 *
 * - `text`: a plain string, such as the prompt passed to an agent
 * - `messages`: a message list, unwrapped from the `{ messages }` envelope
 *   model generation spans and legacy agent spans record
 * - `agent-run-resume`: the resume data of a resumed agent run, whatever shape it has
 * - `json`: anything else, such as tool arguments or workflow step data
 */
export function describeSpanInput(span: SpanRecord): SpanInputDescription | undefined {
  const input: unknown = span.input;
  if (input == null) return undefined;

  // A resumed run's input is resume data whatever it looks like, so the resumed marker
  // settles it before any shape check. Runs resumed before core always recorded an
  // object can hold a bare string, array or number here, which is normalized to match.
  if (span.spanType === SpanType.AGENT_RUN && span.metadata?.resumed === true) {
    const value = isRecord(input) ? input : { resumeData: input };
    return { type: 'agent-run-resume', value: value as AgentRunResumeInput };
  }

  if (typeof input === 'string') return { type: 'text', value: input };
  if (Array.isArray(input)) {
    return MESSAGE_LIST_INPUT_SPANS.includes(span.spanType)
      ? { type: 'messages', value: input as SpanInputMessage[] }
      : { type: 'json', value: input };
  }
  if (!isRecord(input)) return { type: 'json', value: input };

  const isAgentRun = span.spanType === SpanType.AGENT_RUN;
  if ((isAgentRun || span.spanType === SpanType.MODEL_GENERATION) && 'messages' in input) {
    const { messages } = input;
    if (typeof messages === 'string') return { type: 'text', value: messages };
    if (Array.isArray(messages)) return { type: 'messages', value: messages as SpanInputMessage[] };
    if (isRecord(messages)) return { type: 'messages', value: [messages as SpanInputMessage] };
  }
  if (isAgentRun) {
    if (typeof input.role === 'string') return { type: 'messages', value: [input as SpanInputMessage] };
    if ('toolCallId' in input || 'toolName' in input || 'resumeData' in input) {
      return { type: 'agent-run-resume', value: input as AgentRunResumeInput };
    }
  }
  return { type: 'json', value: input };
}

/**
 * Describes a stored span's `output` for rendering: the value tagged by what it
 * holds. Returns `undefined` when the span recorded no output.
 *
 * - `interrupted`: the run suspended or was aborted before the span's result existed
 * - `agent-run-result`, `model-generation-result`, `model-step-result`: the
 *   result of the span type that recorded it
 * - `text`: a plain string
 * - `json`: anything else, such as a tool result or workflow step output
 */
export function describeSpanOutput(span: SpanRecord): SpanOutputDescription | undefined {
  const output: unknown = span.output;
  if (output == null) return undefined;
  if (typeof output === 'string') return { type: 'text', value: output };
  if (!isRecord(output)) return { type: 'json', value: output };

  switch (span.spanType) {
    case SpanType.AGENT_RUN:
      return isInterrupted(output)
        ? { type: 'interrupted', value: output }
        : { type: 'agent-run-result', value: output as AgentRunResult };
    case SpanType.MODEL_GENERATION:
      return isInterrupted(output)
        ? { type: 'interrupted', value: output }
        : { type: 'model-generation-result', value: output as ModelGenerationResult };
    case SpanType.MODEL_STEP:
      return isInterrupted(output)
        ? { type: 'interrupted', value: output }
        : { type: 'model-step-result', value: output as ModelStepResult };
    case SpanType.MODEL_INFERENCE:
      return { type: 'model-step-result', value: output as ModelStepResult };
    default:
      return { type: 'json', value: output };
  }
}

const isSpanErrorInfo = (value: unknown): value is SpanErrorInfo =>
  isRecord(value) && typeof value.message === 'string';

/** The error a stored span recorded, typed, or `undefined` when the span succeeded. */
export function describeSpanError(span: SpanRecord): SpanErrorInfo | undefined {
  return isSpanErrorInfo(span.error) ? span.error : undefined;
}
