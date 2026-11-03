import { coreFeatures } from '@mastra/core/features';
import * as coreObservability from '@mastra/core/observability';
import type { SpanOutcomeFields } from '@mastra/core/observability';
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

/** Keep completed-request usage when a failed request makes the total incomplete. */
export function generationUsage(usage: LanguageModelUsage, steps: Array<{ usage?: LanguageModelUsage }>) {
  const usageIncomplete = coreFeatures.has('execution-outcomes') && coreObservability.isUsageIncomplete?.(usage);
  return {
    usageIncomplete,
    usage: usageIncomplete ? (coreObservability.calculateObservedUsage?.(steps) ?? usage) : usage,
  };
}
