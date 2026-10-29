import * as coreDurable from '@mastra/core/agent/durable';
import { coreFeatures } from '@mastra/core/features';
import * as coreObservability from '@mastra/core/observability';
import type { SpanOutcomeFields } from '@mastra/core/observability';
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

export function endRunSpansWithError(...args: Parameters<typeof coreDurable.endRunSpansWithError>): void {
  if (coreFeatures.has('execution-outcomes')) coreDurable.endRunSpansWithError?.(...args);
}
