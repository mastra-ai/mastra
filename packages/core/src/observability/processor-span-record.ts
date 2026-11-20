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
 *
 * A union over the phases rather than one `phase` field beside a union of
 * payloads: narrowing on `phase` then narrows `data` to that phase's shape.
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
 * writes the same shapes either way. Spans stored before the attribute existed,
 * and spans a newer version wrote with a phase this one does not know, return
 * `undefined` and fall back to JSON.
 */
export function describeProcessorPhase(span: SpanRecord): ProcessorSpanPayloadPhase | undefined {
  const phase = span.attributes?.processorPhase;
  return typeof phase === 'string' && Object.hasOwn(PROCESSOR_PHASE_LABELS, phase)
    ? (phase as ProcessorSpanPayloadPhase)
    : undefined;
}

/**
 * Tags a processor payload with the phase that recorded it.
 *
 * The payload itself is not validated, matching what `isSpanRecordOfType` and
 * the other `describeSpan*` helpers already do: the typed view trusts that the
 * producer for a phase wrote the shape core declares. Renderers guard each
 * field they read, so a partially populated span shows what it has rather than
 * losing the whole view to one unexpected value.
 */
function describeProcessorPayload<TByPhase extends Record<ProcessorSpanPayloadPhase, unknown>>(
  span: SpanRecord,
  data: Record<string, unknown>,
): ProcessorSpanPayload<TByPhase> | undefined {
  const phase = describeProcessorPhase(span);
  // An empty payload has nothing to describe; it stays JSON like any other span's.
  if (!phase || Object.keys(data).length === 0) return undefined;
  return { phase, phaseLabel: PROCESSOR_PHASE_LABELS[phase], data } as ProcessorSpanPayload<TByPhase>;
}

/** The `input` a processor span recorded, tagged by the phase that produced it. */
export function describeProcessorInput(
  span: SpanRecord,
  data: Record<string, unknown>,
): ProcessorSpanPayload<ProcessorRunInputByPhase> | undefined {
  return describeProcessorPayload<ProcessorRunInputByPhase>(span, data);
}

/** The `output` a processor span recorded, tagged by the phase that produced it. */
export function describeProcessorOutput(
  span: SpanRecord,
  data: Record<string, unknown>,
): ProcessorSpanPayload<ProcessorRunOutputByPhase> | undefined {
  return describeProcessorPayload<ProcessorRunOutputByPhase>(span, data);
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

  const attributes = (span.attributes ?? {}) as ProcessorPipelineAttributes & Record<string, unknown>;

  // The two structured fields are checked for the shape this view iterates, and
  // only for that. A value it cannot walk stays in `rest` so the reader still
  // sees it as JSON, rather than the whole description disappearing over one
  // field — a bad mutation log should not hide a good tripwire reason.
  const mutations = Array.isArray(attributes.messageListMutations) ? attributes.messageListMutations : undefined;
  const tripwireAbort =
    typeof attributes.tripwireAbort === 'object' && attributes.tripwireAbort !== null
      ? attributes.tripwireAbort
      : undefined;

  const presented = new Set<string>(PROCESSOR_PIPELINE_KEYS);
  if (attributes.messageListMutations !== undefined && !mutations) presented.delete('messageListMutations');
  if (attributes.tripwireAbort !== undefined && !tripwireAbort) presented.delete('tripwireAbort');

  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!presented.has(key)) rest[key] = value;
  }

  return {
    phase,
    phaseLabel: PROCESSOR_PHASE_LABELS[phase],
    executor: attributes.processorExecutor,
    processorIndex: attributes.processorIndex,
    hookDurationMs: attributes.hookDurationMs,
    messageListMutations: mutations,
    tripwireAbort,
    ...(Object.keys(rest).length > 0 ? { rest } : {}),
  };
}
