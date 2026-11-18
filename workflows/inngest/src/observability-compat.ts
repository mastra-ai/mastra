import * as coreDurable from '@mastra/core/agent/durable';
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
 * The context a suspending workflow run saves for its resume. A core without the helper saves the
 * lineage alone, and its resume samples again.
 */
export function workflowResumeTracingContext(
  span: Parameters<typeof coreObservability.getWorkflowResumeTracingContext>[0],
): ResumeTracingContext | undefined {
  if (coreFeatures.has('workflow-resume-sampling')) return coreObservability.getWorkflowResumeTracingContext?.(span);
  return coreObservability.getResumeTracingContext(span);
}
