import * as coreDurable from '@mastra/core/agent/durable';
import { coreFeatures } from '@mastra/core/features';
import * as coreObservability from '@mastra/core/observability';
import type { AIModelGenerationSpan, ExportedSpan, SpanOutcomeFields, SpanType } from '@mastra/core/observability';
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

/** Keep completed-request usage when a failed request makes the total incomplete. */
export function generationUsage(usage: LanguageModelUsage, steps: Array<{ usage?: LanguageModelUsage }>) {
  const usageIncomplete = coreFeatures.has('execution-outcomes') && coreObservability.isUsageIncomplete?.(usage);
  return {
    usageIncomplete,
    usage: usageIncomplete ? (coreObservability.calculateObservedUsage?.(steps) ?? usage) : usage,
  };
}

const RESUME_SEGMENTS = 'durable-resume-segments';

/** Open a resumed segment's spans and carry them to the workers; an older core opens none. */
export function openSegment(
  ...args: Parameters<typeof coreDurable.openSegment>
): ReturnType<typeof coreDurable.openSegment> {
  return coreFeatures.has(RESUME_SEGMENTS) ? coreDurable.openSegment?.(...args) : undefined;
}

/** The segment a persisted snapshot was suspended in; an older core knows only the first pair. */
export function segmentFromSnapshot(
  ...args: Parameters<typeof coreDurable.segmentFromSnapshot>
): ReturnType<typeof coreDurable.segmentFromSnapshot> {
  if (coreFeatures.has(RESUME_SEGMENTS)) return coreDurable.segmentFromSnapshot(...args);
  const input = args[0]?.context?.input as coreDurable.SegmentSpanData | undefined;
  return { agentSpanData: input?.agentSpanData, modelSpanData: input?.modelSpanData };
}

/** The registry fields an older core keeps its resumed pair and clocks on. */
interface LegacyRegistryEntry extends coreDurable.RunRegistryEntry {
  resumeAgentSpan?: coreDurable.RunRegistryEntry['agentSpan'];
  resumeModelSpan?: AIModelGenerationSpan;
  resumeAgentSpanData?: unknown;
  resumeModelSpanData?: unknown;
  resumeCompletionStartTime?: Date;
  resumeTimeToFirstTokenMs?: number;
}

/**
 * The segment a step ends. An older core resolves it the way its own steps do: the state's first
 * pair, with the resumed pair and clocks this process's registry holds on top.
 */
export function currentSegment(args: Parameters<typeof coreDurable.currentSegment>[0]): coreDurable.DurableSegment {
  if (coreFeatures.has(RESUME_SEGMENTS)) return coreDurable.currentSegment(args);
  const { mastra, requestContext, runId, state } = args;
  const registry = coreDurable.getRunRegistryEntry(runId, mastra) as LegacyRegistryEntry | undefined;
  const observability = mastra?.observability?.getSelectedInstance({ requestContext });
  const agentSpanData = (registry?.resumeAgentSpanData ?? state.agentSpanData) as
    | ExportedSpan<SpanType.AGENT_RUN>
    | undefined;
  const modelSpanData = (registry?.resumeModelSpanData ?? state.modelSpanData) as
    | ExportedSpan<SpanType.MODEL_GENERATION>
    | undefined;
  const clocks = registry?.resumeModelSpanData
    ? { completionStartTime: registry.resumeCompletionStartTime, timeToFirstTokenMs: registry.resumeTimeToFirstTokenMs }
    : { completionStartTime: state.completionStartTime, timeToFirstTokenMs: state.timeToFirstTokenMs };
  return {
    agentSpanData,
    modelSpanData,
    agentSpan: () =>
      registry?.resumeAgentSpan ??
      registry?.agentSpan ??
      (agentSpanData ? observability?.rebuildSpan(agentSpanData) : undefined),
    modelSpan: () =>
      registry?.resumeModelSpan ??
      registry?.modelSpan ??
      (modelSpanData ? (observability?.rebuildSpan(modelSpanData) as AIModelGenerationSpan | undefined) : undefined),
    ownsStep: () => true,
    clocks: () => {
      const attributes = {
        ...(clocks.completionStartTime ? { completionStartTime: new Date(clocks.completionStartTime) } : {}),
        ...(clocks.timeToFirstTokenMs !== undefined ? { timeToFirstTokenMs: clocks.timeToFirstTokenMs } : {}),
      };
      return Object.keys(attributes).length ? attributes : undefined;
    },
  };
}
