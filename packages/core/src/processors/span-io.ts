/**
 * Typed `input` / `output` payloads for processor spans.
 *
 * The payload types are NOT hand-written. They are projected from the processor
 * args/result types (`ProcessInputStepArgs`, `ProcessOutputStepArgs`, ...) via an
 * exhaustive spec: every key of the source type must be classified as `keep`,
 * `optional`, `omit`, or `{ summary }`. Adding a field to a processor args type
 * without deciding whether it belongs in the trace is a compile error on the spec,
 * and the span builders (`runner.ts`, `workflows/workflow.ts`,
 * `workflows/evented/workflow.ts`) are annotated against the projected types so a
 * `keep` decision that is not honoured by a builder is a compile error too.
 *
 * Nothing here runs at request time beyond `getProcessorSpanPhase` /
 * `isProcessorSpan`; the specs exist to carry `satisfies` checks.
 */
import { EntityType } from '../observability';
import type { SpanRecord } from '../storage/domains/observability/tracing';
import type {
  ActiveToolSummary,
  ProcessorModelSummary,
  ProcessorResultSummary,
  ProcessorToolChoiceSummary,
  ProcessorToolSummary,
} from './span-payload';
import type {
  ProcessInputArgs,
  ProcessInputResultWithSystemMessages,
  ProcessInputStepArgs,
  ProcessInputStepResult,
  ProcessOutputResultArgs,
  ProcessOutputStepArgs,
  ProcessToolResultArgs,
} from './index';

// ============================================================================
// Projection mechanism
// ============================================================================

/**
 * Per-field decision when projecting processor args onto a span payload.
 * - `keep`: copied as-is, key stays required/optional as in the source.
 * - `optional`: copied as-is but always optional (used when the two executors
 *   diverge — one always emits the key, the other only conditionally).
 * - `omit`: not recorded (runtime handles, non-serializable, or too large).
 * - `{ summary: S }`: replaced by a serializable summary of type `S`; always optional
 *   because summaries return `undefined` when nothing meaningful can be extracted.
 */
export type SpanFieldRule = 'keep' | 'optional' | 'omit' | { summary: unknown };

/** `-?` makes every source key mandatory in the spec, which is what forces exhaustiveness. */
export type SpanProjection<TSource> = { [K in keyof TSource]-?: SpanFieldRule };

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** Applies a projection spec to a source type. */
export type ProjectedSpanPayload<TSource, TSpec extends SpanProjection<TSource>> = Simplify<
  { [K in keyof TSource as TSpec[K] extends 'keep' ? K : never]: TSource[K] } & {
    [K in keyof TSource as TSpec[K] extends 'optional' ? K : never]?: TSource[K];
  } & {
    [K in keyof TSource as TSpec[K] extends { summary: unknown } ? K : never]?: TSpec[K] extends {
      summary: infer S;
    }
      ? S
      : never;
  }
>;

/** Helper to declare a `{ summary }` rule without a runtime value. */
const summary = <S>() => ({ summary: undefined as unknown as S });

// ============================================================================
// Executor divergences surfaced as wider types
// ============================================================================

/**
 * System messages as they appear in span payloads. The legacy runner records
 * `CoreMessageV4[]`; the workflow executor records the looser
 * `{ role, content? }[]` shape of `ProcessorStepInput.systemMessages`.
 * A stored span may come from either, so the payload type is the union-compatible shape.
 */
export type ProcessorSpanSystemMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content?: unknown };

/** Tool calls as recorded by both executors (`args` is optional in the workflow step schema). */
export type ProcessorSpanToolCall = { toolName: string; toolCallId: string; args?: unknown };

/**
 * Fields inherited from `ProcessorContext` / `ObservabilityContext` that are never recorded:
 * runtime handles, callbacks, and per-request context.
 */
const contextOmissions = {
  abort: 'omit',
  requestContext: 'omit',
  agent: 'omit',
  sendSignal: 'omit',
  sendStateSignal: 'omit',
  writer: 'omit',
  abortSignal: 'omit',
  tracing: 'omit',
  loggerVNext: 'omit',
  metrics: 'omit',
  tracingContext: 'omit',
  messageList: 'omit',
} as const;

// ============================================================================
// Phase: input  (entityType INPUT_PROCESSOR)
// ============================================================================

export const processorInputSpanInputSpec = {
  ...contextOmissions,
  messages: 'keep',
  systemMessages: summary<ProcessorSpanSystemMessage[]>(),
  state: 'omit',
  /** Legacy runner never records it, workflow executor records it when present. */
  retryCount: 'optional',
} as const satisfies SpanProjection<ProcessInputArgs>;

export type ProcessorInputSpanInput = ProjectedSpanPayload<ProcessInputArgs, typeof processorInputSpanInputSpec>;

/**
 * Diff of what a message-based processor changed. Only modified fields are emitted.
 * Shared by the `input`, `output`, `outputStep` and `toolResult` phases.
 */
export const processorMessagesDiffSpanOutputSpec = {
  messages: 'optional',
  systemMessages: summary<ProcessorSpanSystemMessage[]>(),
} as const satisfies SpanProjection<ProcessInputResultWithSystemMessages>;

export type ProcessorMessagesDiffSpanOutput = ProjectedSpanPayload<
  ProcessInputResultWithSystemMessages,
  typeof processorMessagesDiffSpanOutputSpec
>;

export type ProcessorInputSpanOutput = ProcessorMessagesDiffSpanOutput;

// ============================================================================
// Phase: inputStep  (entityType INPUT_STEP_PROCESSOR)
// ============================================================================

export const processorInputStepSpanInputSpec = {
  ...contextOmissions,
  messages: 'keep',
  systemMessages: summary<ProcessorSpanSystemMessage[]>(),
  /** Always recorded by the legacy runner, conditionally by the workflow executor. */
  stepNumber: 'optional',
  messageId: 'keep',
  retryCount: 'optional',
  model: summary<ProcessorModelSummary>(),
  tools: summary<ProcessorToolSummary[]>(),
  toolChoice: summary<ProcessorToolChoiceSummary>(),
  activeTools: summary<ActiveToolSummary[]>(),
  steps: 'omit',
  state: 'omit',
  rotateResponseMessageId: 'omit',
  providerOptions: 'omit',
  modelSettings: 'omit',
  structuredOutput: 'omit',
} as const satisfies SpanProjection<ProcessInputStepArgs>;

export type ProcessorInputStepSpanInput = ProjectedSpanPayload<
  ProcessInputStepArgs,
  typeof processorInputStepSpanInputSpec
>;

export const processorInputStepSpanOutputSpec = {
  messages: 'optional',
  systemMessages: summary<ProcessorSpanSystemMessage[]>(),
  messageId: 'optional',
  model: summary<ProcessorModelSummary>(),
  tools: summary<ProcessorToolSummary[]>(),
  toolChoice: summary<ProcessorToolChoiceSummary>(),
  activeTools: summary<ActiveToolSummary[]>(),
  retryCount: 'optional',
  messageList: 'omit',
  providerOptions: 'omit',
  modelSettings: 'omit',
  structuredOutput: 'omit',
} as const satisfies SpanProjection<ProcessInputStepResult>;

export type ProcessorInputStepSpanOutput = ProjectedSpanPayload<
  ProcessInputStepResult,
  typeof processorInputStepSpanOutputSpec
>;

// ============================================================================
// Phase: output  (entityType OUTPUT_PROCESSOR) — result and stream variants
// ============================================================================

export const processorOutputResultSpanInputSpec = {
  ...contextOmissions,
  messages: 'keep',
  result: summary<ProcessorResultSummary>(),
  retryCount: 'optional',
  state: 'omit',
} as const satisfies SpanProjection<ProcessOutputResultArgs>;

export type ProcessorOutputResultSpanInput = ProjectedSpanPayload<
  ProcessOutputResultArgs,
  typeof processorOutputResultSpanInputSpec
>;

/**
 * Streaming output processors aggregate over chunks rather than receiving a single
 * args object, so their payload is not a projection. The legacy runner records
 * `accumulatedText`; the workflow executor only records `totalChunks`.
 */
export interface ProcessorOutputStreamSpanInput {
  totalChunks: number;
  accumulatedText?: string;
}
export type ProcessorOutputStreamSpanOutput = ProcessorOutputStreamSpanInput;

/** Both variants share `entityType: OUTPUT_PROCESSOR`, so the stored payload is the union. */
export type ProcessorOutputSpanInput = ProcessorOutputResultSpanInput | ProcessorOutputStreamSpanInput;
export type ProcessorOutputSpanOutput = ProcessorMessagesDiffSpanOutput | ProcessorOutputStreamSpanOutput;

// ============================================================================
// Phase: outputStep  (entityType OUTPUT_STEP_PROCESSOR)
// ============================================================================

export const processorOutputStepSpanInputSpec = {
  ...contextOmissions,
  messages: 'keep',
  systemMessages: summary<ProcessorSpanSystemMessage[]>(),
  stepNumber: 'optional',
  finishReason: 'keep',
  toolCalls: summary<ProcessorSpanToolCall[]>(),
  text: 'keep',
  retryCount: 'optional',
  providerMetadata: 'omit',
  usage: 'omit',
  steps: 'omit',
  state: 'omit',
} as const satisfies SpanProjection<ProcessOutputStepArgs>;

export type ProcessorOutputStepSpanInput = ProjectedSpanPayload<
  ProcessOutputStepArgs,
  typeof processorOutputStepSpanInputSpec
>;
export type ProcessorOutputStepSpanOutput = ProcessorMessagesDiffSpanOutput;

// ============================================================================
// Phase: toolResult  (entityType TOOL_RESULT_PROCESSOR)
// ============================================================================

export const processorToolResultSpanInputSpec = {
  ...contextOmissions,
  stepNumber: 'optional',
  toolName: 'optional',
  toolCallId: 'optional',
  providerExecuted: 'keep',
  retryCount: 'optional',
  messages: 'omit',
  systemMessages: 'omit',
  args: 'omit',
  result: 'omit',
  steps: 'omit',
  state: 'omit',
} as const satisfies SpanProjection<ProcessToolResultArgs>;

export type ProcessorToolResultSpanInput = ProjectedSpanPayload<
  ProcessToolResultArgs,
  typeof processorToolResultSpanInputSpec
>;
export type ProcessorToolResultSpanOutput = ProcessorMessagesDiffSpanOutput;

// ============================================================================
// Phase map, discriminant and guards
// ============================================================================

export interface ProcessorSpanIOMap {
  input: { input: ProcessorInputSpanInput; output: ProcessorInputSpanOutput };
  inputStep: { input: ProcessorInputStepSpanInput; output: ProcessorInputStepSpanOutput };
  output: { input: ProcessorOutputSpanInput; output: ProcessorOutputSpanOutput };
  outputStep: { input: ProcessorOutputStepSpanInput; output: ProcessorOutputStepSpanOutput };
  toolResult: { input: ProcessorToolResultSpanInput; output: ProcessorToolResultSpanOutput };
}

export type ProcessorSpanIOPhase = keyof ProcessorSpanIOMap;

/**
 * Stored `entityType` → payload phase. This is the only discriminant available on a
 * persisted span: `spanType` is `PROCESSOR_RUN` (or a processor-declared override)
 * for every phase, and `name` is cosmetic.
 *
 * Known over-approximation: the legacy-only `llmRequest` / `llmResponse` phases are
 * recorded with `INPUT_PROCESSOR`, and `requestError` with `OUTPUT_STEP_PROCESSOR`.
 * Their payloads (`{ prompt, stepNumber, retryCount }`, `{ stepNumber, retryCount,
 * fromCache, chunkCount }`, `{ messages, error, stepNumber, messageId?, retryCount }`)
 * do not match the phase types below, so `isProcessorSpan` narrows them incorrectly.
 * Disambiguating them requires persisting a phase attribute, which is out of scope here.
 */
export const PROCESSOR_ENTITY_TYPE_TO_PHASE = {
  [EntityType.INPUT_PROCESSOR]: 'input',
  [EntityType.INPUT_STEP_PROCESSOR]: 'inputStep',
  [EntityType.OUTPUT_PROCESSOR]: 'output',
  [EntityType.OUTPUT_STEP_PROCESSOR]: 'outputStep',
  [EntityType.TOOL_RESULT_PROCESSOR]: 'toolResult',
} as const satisfies Partial<Record<EntityType, ProcessorSpanIOPhase>>;

export type ProcessorSpanRecord<P extends ProcessorSpanIOPhase> = Omit<SpanRecord, 'input' | 'output'> & {
  input?: ProcessorSpanIOMap[P]['input'] | null;
  output?: ProcessorSpanIOMap[P]['output'] | null;
};

export function getProcessorSpanPhase(span: Pick<SpanRecord, 'entityType'>): ProcessorSpanIOPhase | undefined {
  if (!span.entityType) return undefined;
  return (PROCESSOR_ENTITY_TYPE_TO_PHASE as Partial<Record<EntityType, ProcessorSpanIOPhase>>)[span.entityType];
}

/** Narrows a stored span to the payload types of `phase`, based on `entityType` only. */
export function isProcessorSpan<P extends ProcessorSpanIOPhase>(
  span: SpanRecord,
  phase: P,
): span is ProcessorSpanRecord<P> {
  return getProcessorSpanPhase(span) === phase;
}
