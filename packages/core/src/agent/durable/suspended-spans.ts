import type { Mastra } from '../../mastra';
import type { AIModelGenerationSpan, ExportedSpan, SpanType } from '../../observability';
import { compactStopReasonContext } from '../../observability/outcome-schema';
import { extractUsageMetrics, isUsageIncomplete, subtractReportedUsage } from '../../observability/usage';
import type { RequestContext } from '../../request-context';
import { getRunRegistryEntry } from './run-registry';
import { liveSegmentSpan, segmentOwnsStep, segmentSpanData } from './segment-spans';
import type { DurableToolCallInput } from './types';
import { calculateAccumulatedUsage, carriedSpanClocks } from './workflows/shared/iteration-state';
import type { AccumulatedUsage, BaseIterationState } from './workflows/shared/schemas';

export interface SuspendInfo {
  toolCallId?: string;
  toolName?: string;
  reason?: string;
}

/** End the open MODEL_STEP, MODEL_GENERATION and AGENT_RUN of the segment that `call` suspended. Never throws. */
export function endSuspendedSpans({
  mastra,
  requestContext,
  state,
  call,
  info,
}: {
  mastra: Mastra | undefined;
  requestContext: RequestContext<any>;
  state: {
    runId: string;
    agentSpanData?: unknown;
    modelSpanData?: unknown;
    completionStartTime?: Date | string;
    timeToFirstTokenMs?: number;
    accumulatedUsage: AccumulatedUsage;
    generationReportedUsage?: AccumulatedUsage;
    generationReportedSteps?: number;
    reportedCosts?: BaseIterationState['reportedCosts'];
  };
  call: DurableToolCallInput;
  info: SuspendInfo;
}): void {
  try {
    const obs = mastra?.observability?.getSelectedInstance({ requestContext });
    if (!obs) return;
    const output = {
      status: 'suspended' as const,
      reason: info.reason,
      toolName: info.toolName,
      toolCallId: info.toolCallId,
    };
    // The pair this execution reports under: the run's first, or the one a resume or
    // recovery carried on the request context.
    const reg = getRunRegistryEntry(state.runId, mastra);
    const segment = segmentSpanData(requestContext, state.runId, state, reg);
    const { agentSpanData, modelSpanData } = segment;
    // Rebuilt spans come from the run-start snapshot, so end them with the clocks
    // their segment captured: the loop state's (or this step's, on the first
    // iteration) for the originals.
    const attributes = carriedSpanClocks(
      reg,
      state.completionStartTime
        ? { completionStartTime: state.completionStartTime, timeToFirstTokenMs: state.timeToFirstTokenMs }
        : {
            completionStartTime: call.completionStartTime,
            timeToFirstTokenMs: call.timeToFirstTokenMs,
          },
      segment.carried,
    );
    // This segment made the suspended step's model call only when it owns the step; a later
    // suspension of the same step, after a resume, made none. The generation records the
    // run total so far less what earlier suspensions recorded, like the regular agent.
    // Tool calls that run side by side can each suspend here, so none of them records it.
    // A total the provider left partly unknown is not recorded either: its known detail
    // counts would be reported without the total they are part of.
    const ownsStep = !!call.stepSpanData && segmentOwnsStep(segment, call.stepSpanData);
    const reported = state.generationReportedUsage;
    const total = calculateAccumulatedUsage(state.accumulatedUsage, call.stepUsage);
    const usage =
      reported && ownsStep && !call.sideBySide && !isUsageIncomplete(total)
        ? subtractReportedUsage(total, reported)
        : undefined;
    if (ownsStep) {
      const stepSpanData = call.stepSpanData as ExportedSpan<SpanType.MODEL_STEP>;
      (liveSegmentSpan(stepSpanData, reg?.openStepSpan) ?? obs.rebuildSpan(stepSpanData))?.end({
        output,
        ...(reported ? { attributes: { usage: extractUsageMetrics(call.stepUsage) } } : {}),
        outcome: 'suspend',
        stopReason: info.reason === 'approval' ? 'approval_required' : null,
        stopReasonContext:
          info.reason === 'approval'
            ? compactStopReasonContext('approval_required', {
                toolCallId: info.toolCallId,
                toolName: info.toolName,
              })
            : null,
      });
    }
    const agentSpan = agentSpanData && obs.rebuildSpan(agentSpanData);
    if (modelSpanData) {
      const end = {
        output,
        attributes,
        outcome: 'suspend' as const,
        stopReason: info.reason === 'approval' ? ('approval_required' as const) : null,
        stopReasonContext:
          info.reason === 'approval'
            ? compactStopReasonContext('approval_required', {
                toolCallId: info.toolCallId,
                toolName: info.toolName,
              })
            : null,
      };
      const modelSpan = obs.rebuildSpan(modelSpanData) as AIModelGenerationSpan | undefined;
      // A hidden generation reports its usage on its parent; a rebuilt one has no live parent.
      if (modelSpan?.isInternal) modelSpan.parent ??= agentSpan;
      if (usage) {
        // As at the end of the run: the model that answered, and the cost its provider reported.
        const servedBy = call.response?.servedBy;
        const servedName = servedBy && `llm: '${servedBy.modelId}'`;
        if (servedName && modelSpan && modelSpan.name !== servedName) modelSpan.update({ name: servedName });
        const costs = state.reportedCosts?.slice(state.generationReportedSteps ?? 0) ?? [];
        modelSpan?.createTracker()?.endGeneration({
          ...end,
          attributes: {
            ...attributes,
            ...(servedBy ? { model: servedBy.modelId, provider: servedBy.provider } : {}),
          },
          usage,
          stepProviderMetadata: [...costs, call.response?.reportedCost].map(cost => cost ?? undefined),
        });
      } else modelSpan?.end(end);
    }
    agentSpan?.end({
      output,
      attributes,
      outcome: 'suspend',
      stopReason: info.reason === 'approval' ? 'approval_required' : null,
      stopReasonContext:
        info.reason === 'approval'
          ? compactStopReasonContext('approval_required', {
              toolCallId: info.toolCallId,
              toolName: info.toolName,
            })
          : null,
    });
  } catch (error) {
    // Span bookkeeping must never break suspension.
    mastra?.getLogger?.()?.warn?.(`[DurableAgent] Failed to end spans on suspend: ${error}`);
  }
}
