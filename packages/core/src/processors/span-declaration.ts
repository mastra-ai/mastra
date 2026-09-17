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

/** Resolve a processor's declared span attributes for this phase. */
export function resolveProcessorSpanAttributes(
  processor: Pick<Processor, 'spanAttributes'>,
  phase: ProcessorSpanPhase,
) {
  const declared = processor.spanAttributes;
  return typeof declared === 'function' ? declared(phase) : declared;
}
