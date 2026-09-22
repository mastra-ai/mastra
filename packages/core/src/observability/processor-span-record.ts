import type { SpanRecord } from '../storage/domains/observability/tracing';
import type {
  ProcessorPipelineAttributes,
  ProcessorRunInputByPhase,
  ProcessorRunOutputByPhase,
  ProcessorSpanPayloadPhase,
} from './types';

/**
 * A processor span's payload with the phase that produced it, so a renderer can
 * switch on `phase` instead of sniffing the payload's shape.
 */
export type ProcessorSpanPayload<TByPhase extends Record<ProcessorSpanPayloadPhase, unknown>> = {
  [P in ProcessorSpanPayloadPhase]: {
    phase: P;
    /** The phase written for people, e.g. `'Tool result'`. */
    phaseLabel: string;
    data: TByPhase[P];
  };
}[ProcessorSpanPayloadPhase];

/** Phase names as they are shown to a reader. */
const PROCESSOR_PHASE_LABELS: Record<ProcessorSpanPayloadPhase, string> = {
  input: 'Input',
  inputStep: 'Input step',
  llmRequest: 'LLM request',
  llmResponse: 'LLM response',
  outputStream: 'Output stream',
  outputResult: 'Output result',
  outputStep: 'Output step',
  toolResult: 'Tool result',
  requestError: 'Request error',
};

/**
 * The phase a processor span recorded, or `undefined` when it recorded none.
 *
 * Read from `attributes` rather than `spanType`, so a processor that retyped
 * its span (`Processor.spanType`) still describes its payloads — the runner
 * writes the same shapes either way. Spans stored before the attribute existed
 * return `undefined` and fall back to JSON.
 */
export function describeProcessorPhase(span: SpanRecord): ProcessorSpanPayloadPhase | undefined {
  const phase = span.attributes?.processorPhase;
  return isProcessorPhase(phase) ? phase : undefined;
}

function isProcessorPhase(value: unknown): value is ProcessorSpanPayloadPhase {
  return typeof value === 'string' && Object.hasOwn(PROCESSOR_PHASE_LABELS, value);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);

/** Validate only the known fields. Unknown fields remain on the original payload for JSON rendering. */
function hasOptionalFields(
  value: Record<string, unknown>,
  fields: Record<string, (field: unknown) => boolean>,
): boolean {
  return Object.entries(fields).every(([key, validate]) => value[key] === undefined || validate(value[key]));
}

const isModelSummary = (value: unknown): boolean =>
  isRecord(value) &&
  hasOptionalFields(value, { modelId: isString, provider: isString, specificationVersion: isString });
const isActiveTool = (value: unknown): boolean => isRecord(value) && isString(value.id) && isString(value.name);
const isToolSummary = (value: unknown): boolean =>
  isRecord(value) && isActiveTool(value) && hasOptionalFields(value, { description: isString });
const isToolChoice = (value: unknown): boolean =>
  isRecord(value) && isString(value.type) && hasOptionalFields(value, { tool: isActiveTool });

// These are the fields the typed descriptions and Studio renderer consume.
// Message contents are intentionally unknown: the shared message renderer handles their variants.
const PROCESSOR_PAYLOAD_FIELDS = {
  messages: Array.isArray,
  systemMessages: Array.isArray,
  toolCalls: Array.isArray,
  text: isString,
  accumulatedText: isString,
  error: isString,
  toolName: isString,
  toolCallId: isString,
  stepNumber: isNumber,
  finishReason: isString,
  totalChunks: isNumber,
  chunkCount: isNumber,
  retryCount: isNumber,
  messageId: isString,
  fromCache: isBoolean,
  providerExecuted: isBoolean,
  result: isRecord,
  model: isModelSummary,
  tools: (value: unknown) => Array.isArray(value) && value.every(isToolSummary),
  toolChoice: isToolChoice,
  activeTools: (value: unknown) => Array.isArray(value) && value.every(isActiveTool),
};

function isProcessorInput<P extends ProcessorSpanPayloadPhase>(
  phase: P,
  data: Record<string, unknown>,
): data is Record<string, unknown> & ProcessorRunInputByPhase[P] {
  if (!hasOptionalFields(data, PROCESSOR_PAYLOAD_FIELDS)) return false;
  switch (phase) {
    case 'input':
    case 'inputStep':
    case 'outputResult':
    case 'outputStep':
      return Array.isArray(data.messages);
    case 'requestError':
      return Array.isArray(data.messages) && isString(data.error);
    case 'outputStream':
      return isNumber(data.totalChunks);
    default:
      return true;
  }
}

function isProcessorOutput<P extends ProcessorSpanPayloadPhase>(
  phase: P,
  data: Record<string, unknown>,
): data is Record<string, unknown> & ProcessorRunOutputByPhase[P] {
  if (!hasOptionalFields(data, PROCESSOR_PAYLOAD_FIELDS)) return false;
  return phase !== 'outputStream' || (isNumber(data.totalChunks) && isString(data.accumulatedText));
}

function processorInput<P extends ProcessorSpanPayloadPhase>(phase: P, data: Record<string, unknown>) {
  return isProcessorInput(phase, data) ? { phase, phaseLabel: PROCESSOR_PHASE_LABELS[phase], data } : undefined;
}

function processorOutput<P extends ProcessorSpanPayloadPhase>(phase: P, data: Record<string, unknown>) {
  return isProcessorOutput(phase, data) ? { phase, phaseLabel: PROCESSOR_PHASE_LABELS[phase], data } : undefined;
}

export function describeProcessorInput(
  span: SpanRecord,
  data: Record<string, unknown>,
): ProcessorSpanPayload<ProcessorRunInputByPhase> | undefined {
  switch (describeProcessorPhase(span)) {
    case 'input':
      return processorInput('input', data);
    case 'inputStep':
      return processorInput('inputStep', data);
    case 'outputResult':
      return processorInput('outputResult', data);
    case 'outputStep':
      return processorInput('outputStep', data);
    case 'outputStream':
      return processorInput('outputStream', data);
    case 'toolResult':
      return processorInput('toolResult', data);
    case 'llmRequest':
      return processorInput('llmRequest', data);
    case 'llmResponse':
      return processorInput('llmResponse', data);
    case 'requestError':
      return processorInput('requestError', data);
    default:
      return undefined;
  }
}

export function describeProcessorOutput(
  span: SpanRecord,
  data: Record<string, unknown>,
): ProcessorSpanPayload<ProcessorRunOutputByPhase> | undefined {
  switch (describeProcessorPhase(span)) {
    case 'input':
      return processorOutput('input', data);
    case 'inputStep':
      return processorOutput('inputStep', data);
    case 'outputResult':
      return processorOutput('outputResult', data);
    case 'outputStep':
      return processorOutput('outputStep', data);
    case 'outputStream':
      return processorOutput('outputStream', data);
    case 'toolResult':
      return processorOutput('toolResult', data);
    case 'llmRequest':
      return processorOutput('llmRequest', data);
    case 'llmResponse':
      return processorOutput('llmResponse', data);
    case 'requestError':
      return processorOutput('requestError', data);
    default:
      return undefined;
  }
}

/**
 * The pipeline facts a processor span records, with the phase resolved and the
 * remaining attributes kept apart.
 *
 * `rest` is everything this view does not explain: a declared span type's own
 * attributes, and anything a processor set itself. Keeping it separate is what
 * lets a reader show the known fields as labelled values without repeating them
 * in an undifferentiated JSON blob beside them.
 */
export interface ProcessorPipelineDescription {
  phase: ProcessorSpanPayloadPhase;
  phaseLabel: string;
  executor?: 'workflow' | 'legacy';
  processorIndex?: number;
  hookDurationMs?: number;
  messageListMutations?: ProcessorPipelineAttributes['messageListMutations'];
  tripwireAbort?: ProcessorPipelineAttributes['tripwireAbort'];
  /** Attributes this description does not cover; `undefined` when there are none. */
  rest?: Record<string, unknown>;
}

type ProcessorMutation = NonNullable<ProcessorPipelineAttributes['messageListMutations']>[number];

function isProcessorMutation(value: unknown): value is ProcessorMutation {
  return (
    isRecord(value) &&
    (value.type === 'add' || value.type === 'addSystem' || value.type === 'removeByIds' || value.type === 'clear') &&
    hasOptionalFields(value, { source: isString, count: isNumber, ids: isStringArray, text: isString, tag: isString })
  );
}

function isProcessorPipeline(value: unknown): value is ProcessorPipelineAttributes & Record<string, unknown> {
  return (
    isRecord(value) &&
    hasOptionalFields(value, {
      processorExecutor: field => field === 'workflow' || field === 'legacy',
      processorIndex: field => isNumber(field) && Number.isInteger(field) && field >= 0,
      hookDurationMs: field => isNumber(field) && field >= 0,
      messageListMutations: field => Array.isArray(field) && field.every(isProcessorMutation),
      tripwireAbort: field => isRecord(field) && hasOptionalFields(field, { reason: isString, retry: isBoolean }),
    })
  );
}

/** Attribute keys `describeProcessorPipeline` accounts for. */
const PROCESSOR_PIPELINE_KEYS = [
  'processorPhase',
  'processorExecutor',
  'processorIndex',
  'hookDurationMs',
  'messageListMutations',
  'tripwireAbort',
] as const satisfies readonly (keyof ProcessorPipelineAttributes)[];

/**
 * Describes the runner-owned attributes of a processor span for rendering.
 * Returns `undefined` when the span recorded no phase, so a legacy or
 * non-processor span falls back to its raw attributes.
 */
export function describeProcessorPipeline(span: SpanRecord): ProcessorPipelineDescription | undefined {
  const phase = describeProcessorPhase(span);
  if (!phase) return undefined;

  const attributes = span.attributes;
  if (!isProcessorPipeline(attributes)) return undefined;
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!(PROCESSOR_PIPELINE_KEYS as readonly string[]).includes(key)) rest[key] = value;
  }

  return {
    phase,
    phaseLabel: PROCESSOR_PHASE_LABELS[phase],
    executor: attributes.processorExecutor,
    processorIndex: attributes.processorIndex,
    hookDurationMs: attributes.hookDurationMs,
    messageListMutations: attributes.messageListMutations,
    tripwireAbort: attributes.tripwireAbort,
    ...(Object.keys(rest).length > 0 ? { rest } : {}),
  };
}
