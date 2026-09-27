/**
 * Resolution of a processor's declared span identity.
 *
 * A processor may declare the span type, name and attributes it should be
 * traced as (see `Processor.spanType`). Spans for processors are created in two
 * places — the legacy `ProcessorRunner` and the processor-workflow executor —
 * so the resolution lives here and both call it. A declaration honoured by only
 * one executor would apply or not depending on how the agent happened to run
 * its processors.
 */
import type { ProcessorSpanPayloadPhase } from '../observability';
import type { Processor, ProcessorSpanPhase } from './index';

/**
 * Phase names used by the processor-workflow executor, mapped onto
 * `ProcessorSpanPhase`. The executor distinguishes `outputStream` from
 * `outputResult`; both are the output phase as far as a declaration is
 * concerned, matching how they share one entity type.
 */
const WORKFLOW_PHASE_TO_SPAN_PHASE: Record<string, ProcessorSpanPhase> = {
  input: 'input',
  inputStep: 'inputStep',
  llmRequest: 'llmRequest',
  llmResponse: 'llmResponse',
  outputStream: 'output',
  outputResult: 'output',
  outputStep: 'outputStep',
  toolResult: 'toolResult',
  requestError: 'requestError',
};

/** Map a processor-workflow phase string onto the declaration phase. */
export function toProcessorSpanPhase(phase: string): ProcessorSpanPhase {
  return WORKFLOW_PHASE_TO_SPAN_PHASE[phase] ?? 'output';
}

/** The span type a processor declared, or `undefined` to use the default. */
export function resolveProcessorSpanType(processor: Pick<Processor, 'spanType'>) {
  return processor.spanType;
}

/**
 * Resolve a processor's declared span name for the phase the span is being
 * created in, falling back to the caller's default label.
 */
export function resolveProcessorSpanName(
  processor: Pick<Processor, 'spanName'>,
  phase: ProcessorSpanPhase,
  fallback: string,
): string {
  const declared = processor.spanName;
  if (typeof declared === 'function') return declared(phase);
  return declared ?? fallback;
}

/**
 * Resolve a processor's declared span attributes for this phase, with the phase
 * itself recorded alongside them.
 *
 * The phase is applied last so a declaration cannot misreport which phase ran:
 * readers narrow a processor span's payloads on this attribute, and a processor
 * naming itself into another phase would hand them the wrong shape.
 */
export function resolveProcessorSpanAttributes(
  processor: Pick<Processor, 'spanAttributes'> | undefined,
  phase: ProcessorSpanPayloadPhase,
) {
  const declared = processor?.spanAttributes;
  // The declaration callback keeps seeing the coarser phase it was written
  // against; only the recorded attribute distinguishes the two output hooks.
  const declarationPhase = toProcessorSpanPhase(phase);
  return {
    ...(typeof declared === 'function' ? declared(declarationPhase) : declared),
    processorPhase: phase,
  };
}
