import * as coreDurable from '@mastra/core/agent/durable';
import type { SegmentSpanData } from '@mastra/core/agent/durable';
import { coreFeatures } from '@mastra/core/features';
import * as coreObservability from '@mastra/core/observability';
import type { ResumeTracingContext, SpanOutcomeFields } from '@mastra/core/observability';
import type { LanguageModelUsage } from '@mastra/core/stream';
import * as coreWorkflows from '@mastra/core/workflows';

/** Older core keeps its existing tracing behavior without requiring new named exports. */
export function workflowTermination(...args: Parameters<typeof coreWorkflows.workflowTermination>): SpanOutcomeFields {
  return coreFeatures.has('execution-outcomes') ? (coreWorkflows.workflowTermination?.(...args) ?? {}) : {};
}

export function agentLoopTermination(
  ...args: Parameters<typeof coreObservability.agentLoopTermination>
): SpanOutcomeFields {
  return coreFeatures.has('execution-outcomes') ? (coreObservability.agentLoopTermination?.(...args) ?? {}) : {};
}

/** End the caller's live root spans with `error`; a no-op on cores without the helper. */
export function endRunSpansWithError(...args: Parameters<typeof coreDurable.endRunSpansWithError>): void {
  if (coreFeatures.has('execution-outcomes')) coreDurable.endRunSpansWithError?.(...args);
}

export function executionFailureTermination(
  ...args: Parameters<typeof coreObservability.executionFailureTermination>
): SpanOutcomeFields {
  return coreFeatures.has('execution-outcomes') ? (coreObservability.executionFailureTermination?.(...args) ?? {}) : {};
}

/** Keep completed-request usage when a failed request makes the total incomplete. */
export function generationUsage(usage: LanguageModelUsage, steps: Array<{ usage?: LanguageModelUsage }>) {
  const usageIncomplete = coreFeatures.has('execution-outcomes') && coreObservability.isUsageIncomplete?.(usage);
  return {
    usageIncomplete,
    usage: usageIncomplete ? (coreObservability.calculateObservedUsage?.(steps) ?? usage) : usage,
  };
}

/**
 * Whether the durable steps of this core end the span pair a resume carries on the request context.
 * Without it a resume opens no pair, since no worker would end it.
 */
export function carriesSegmentSpans(): boolean {
  return coreFeatures.has('durable-segment-spans');
}

/** Record the pair a resume opened, or `null` for none, for the workers' steps; a no-op on older cores. */
export function carrySegmentSpans(...args: Parameters<typeof coreDurable.carrySegmentSpans>): void {
  if (carriesSegmentSpans()) coreDurable.carrySegmentSpans?.(...args);
}

/** The pair the current execution reports under; an older core reports under the run's first pair. */
export function segmentSpanData(
  ...args: Parameters<typeof coreDurable.segmentSpanData>
): SegmentSpanData & { carried?: boolean } {
  if (carriesSegmentSpans()) return coreDurable.segmentSpanData?.(...args) ?? {};
  const [, , state] = args;
  return {
    agentSpanData: state.agentSpanData as SegmentSpanData['agentSpanData'],
    modelSpanData: state.modelSpanData as SegmentSpanData['modelSpanData'],
  };
}

/** The live span behind `data` held by this process; an older core ends the first live span it holds. */
export function liveSegmentSpan<S extends { id: string }>(
  data: { id: string } | undefined,
  ...candidates: Array<S | undefined>
): S | undefined {
  if (carriesSegmentSpans()) return coreDurable.liveSegmentSpan?.(data, ...candidates);
  return candidates.find(span => span !== undefined);
}

/**
 * The context a suspending workflow run saves for its resume. A core without the helper saves the
 * lineage alone, and its resume samples again.
 */
export function workflowResumeTracingContext(
  span: Parameters<typeof coreObservability.getWorkflowResumeTracingContext>[0],
): ResumeTracingContext | undefined {
  if (coreFeatures.has('workflow-resume-sampling')) return coreObservability.getWorkflowResumeTracingContext?.(span);
  return coreObservability.getResumeTracingContext(span);
}
