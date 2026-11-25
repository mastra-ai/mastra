/**
 * Which AGENT_RUN + MODEL_GENERATION pair a durable execution reports under.
 *
 * A segment is one execution of the durable loop: the run's start, or a resume or a recovery, up
 * to its suspension or its end. Each segment has its own span pair and ends its own spans once.
 * The run's first pair travels in the workflow input. A resume or recovery opens the next pair and
 * carries it on the request context, which every engine hands to every step and persists with the
 * run, so the worker that finishes a segment ends that segment's spans wherever it runs.
 */
import { NoopLeaseProvider } from '../../events/pubsub';
import { reachesOtherProcesses } from '../../events/reach';
import { executionFailureTermination } from '../../loop/shared/execution-outcome';
import { isMastraTimeoutError } from '../../loop/timeout';
import type { Mastra } from '../../mastra';
import { resolveExportedSpanId } from '../../observability';
import type { AIModelGenerationSpan, ExportedSpan, Span, SpanType } from '../../observability';
import type { RequestContext } from '../../request-context';
import { MASTRA_DURABLE_SEGMENTS_KEY } from '../request-context-snapshot';
import { DurableStepIds, MAP_FINAL_OUTPUT_STEP_ID } from './constants';
import { getExecutionClaim, resolveLeaseProvider } from './execution-fence';
import type { RunRegistryEntry } from './types';

export interface SegmentSpanData {
  agentSpanData?: ExportedSpan<SpanType.AGENT_RUN>;
  modelSpanData?: ExportedSpan<SpanType.MODEL_GENERATION>;
  /** The parent id this pair's MODEL_STEPs report: its generation, or the nearest exported ancestor. */
  stepParentId?: string;
  /** Recovery: it finishes the MODEL_STEP the crashed execution left open. */
  adoptsOpenSteps?: boolean;
  /** Recovery: the only generations whose MODEL_STEP the crash left open, when the snapshot names them. */
  openStepsOf?: string[];
  /** Recovery without `openStepsOf`: the MODEL_GENERATION a suspension ended before the crash, whose steps stay ended. */
  endedStepsOf?: string;
}

/** The wire form of the pair a resume or recovery opened. */
export function openedSegment(
  agentSpan: Span<SpanType.AGENT_RUN>,
  modelSpan: AIModelGenerationSpan | undefined,
): SegmentSpanData {
  return {
    agentSpanData: agentSpan.snapshot?.() ?? agentSpan.exportSpan(),
    modelSpanData: modelSpan?.snapshot?.() ?? modelSpan?.exportSpan(),
    stepParentId: resolveExportedSpanId(modelSpan ?? agentSpan),
  };
}

/** A plain record stands in for the context on engines that serialize it before the handoff. */
type CarrierTarget = Pick<RequestContext, 'getRaw' | 'setRaw'> | Record<string, unknown>;

function hasRawAccess(target: CarrierTarget): target is Pick<RequestContext, 'getRaw' | 'setRaw'> {
  return typeof (target as Partial<RequestContext>).setRaw === 'function';
}

function readCarrier(
  requestContext: Pick<RequestContext, 'getRaw'> | undefined,
  runId: string,
): SegmentSpanData | null | undefined {
  const all = requestContext?.getRaw?.(MASTRA_DURABLE_SEGMENTS_KEY) as Record<string, unknown> | undefined;
  if (!all || typeof all !== 'object') return undefined;
  const segment = all[runId] as SegmentSpanData | null | undefined;
  if (segment === null) return null;
  // Parsed at the boundary: a record without a span id ends nothing, so it reads as absent.
  return typeof segment?.agentSpanData?.id === 'string' ? segment : undefined;
}

/**
 * Record the pair a resume or recovery opened for `runId`, or `null` when it opened none, on the
 * request context it hands the engine. Keyed by runId so a delegated durable sub-agent sharing the
 * caller's context cannot overwrite the parent's segment.
 */
export function carrySegmentSpans(target: CarrierTarget, runId: string, segment: SegmentSpanData | null): void {
  const current = hasRawAccess(target)
    ? target.getRaw(MASTRA_DURABLE_SEGMENTS_KEY)
    : target[MASTRA_DURABLE_SEGMENTS_KEY];
  const next = { ...(current && typeof current === 'object' ? current : {}), [runId]: segment };
  if (hasRawAccess(target)) target.setRaw(MASTRA_DURABLE_SEGMENTS_KEY, next);
  else target[MASTRA_DURABLE_SEGMENTS_KEY] = next;
}

/**
 * The pair the current execution reports under: the one a resume or recovery carried for `runId`,
 * else the run's first pair from `state` (the workflow input or the loop state). A carried `null`
 * means the execution opened no spans, so its steps end none. `carried` tells the two apart.
 * `live` is this process's registry entry, the fallback when the context lost the carried pair.
 */
export function segmentSpanData(
  requestContext: Pick<RequestContext, 'getRaw'> | undefined,
  runId: string,
  state: { agentSpanData?: unknown; modelSpanData?: unknown },
  live?: Pick<RunRegistryEntry, 'resumeAgentSpan' | 'resumeModelSpan'>,
): SegmentSpanData & { carried: boolean } {
  const carried = readCarrier(requestContext, runId);
  if (carried === null) return { carried: true };
  if (carried) return { ...carried, carried: true };
  // User code can clear the request context. The process that opened the pair still holds it.
  if (live?.resumeAgentSpan) {
    return { ...openedSegment(live.resumeAgentSpan, live.resumeModelSpan), carried: true };
  }
  return {
    agentSpanData: state.agentSpanData as ExportedSpan<SpanType.AGENT_RUN> | undefined,
    modelSpanData: state.modelSpanData as ExportedSpan<SpanType.MODEL_GENERATION> | undefined,
    carried: false,
  };
}

/**
 * The generations whose MODEL_STEP the execution that persisted `requestContext` left open: its own
 * pair's, plus those it was itself finishing after an earlier crash. Every other step was ended by
 * the suspension before a resume. Undefined when that execution carried no pair.
 */
export function openStepsOfCrashedSegment(
  requestContext: Record<string, unknown> | undefined,
  runId: string,
): string[] | undefined {
  const all = requestContext?.[MASTRA_DURABLE_SEGMENTS_KEY] as Record<string, SegmentSpanData | null> | undefined;
  const crashed = all?.[runId];
  if (!crashed?.stepParentId || (crashed.adoptsOpenSteps && !crashed.openStepsOf)) return undefined;
  return [crashed.stepParentId, ...(crashed.openStepsOf ?? [])];
}

/** The live span behind `data` when this process holds it, so it is ended in place; otherwise undefined. */
export function liveSegmentSpan<S extends { id: string }>(
  data: { id: string } | undefined,
  ...candidates: Array<S | undefined>
): S | undefined {
  return data ? candidates.find(span => span?.id === data.id) : undefined;
}

/**
 * Whether `segment` may end the MODEL_STEP `stepSpanData`. The run's first execution opened every
 * step it sees. A resumed one ends only the steps opened under its own pair: the step that
 * suspended was ended by that suspension. A recovered one also finishes the step its crashed
 * execution left open.
 */
export function segmentOwnsStep(segment: SegmentSpanData & { carried?: boolean }, stepSpanData: unknown): boolean {
  if (!segment.carried) return true;
  const parent = (stepSpanData as { parentSpanId?: string | null } | undefined)?.parentSpanId ?? undefined;
  if (segment.openStepsOf)
    return parent !== undefined && [segment.stepParentId, ...segment.openStepsOf].includes(parent);
  if (segment.adoptsOpenSteps) return segment.endedStepsOf === undefined || parent !== segment.endedStepsOf;
  return parent === segment.stepParentId;
}

/** Longer than any pause between the calls of one step; a key is only written when they run side by side. */
const SEGMENT_END_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Whether `outcome` ends the spans of the run's first segment. Behind a broker, a tool call that suspends and one
 * beside it that fails the run are in different processes, and both end the same spans, so the first one to claim
 * them does. Undefined when no claim can be made, and in one process only the suspension asks.
 */
export async function claimSegmentEnd({
  mastra,
  requestContext,
  runId,
  iterationCount,
  outcome,
}: {
  mastra: Mastra | undefined;
  requestContext: RequestContext<any>;
  runId: string;
  iterationCount: number | undefined;
  outcome: 'suspend' | 'fail';
}): Promise<boolean | undefined> {
  try {
    if (!mastra || !reachesOtherProcesses(mastra.pubsub)) return true;
    const claim = getExecutionClaim(requestContext, runId);
    const leases = resolveLeaseProvider(mastra.pubsub);
    // Only a storage-fenced run has a worker that ends the spans of its failure.
    if (claim?.generation === undefined || leases === NoopLeaseProvider) return undefined;
    const key = `mastra:durable-segment-end:v1:${JSON.stringify([runId, claim.executionId, iterationCount])}`;
    const { acquired, owner } = await leases.acquireLease(key, outcome, SEGMENT_END_TTL_MS);
    return acquired || (owner ? false : undefined);
  } catch {
    return undefined;
  }
}

/** A MODEL_STEP the run's deadline stopped is interrupted, as on the regular agent; the run itself hit a limit. */
export function stepFailure<T extends { error: Error }>(failure: T): T {
  return isMastraTimeoutError(failure.error) ? { ...failure, outcome: 'interrupted' as const } : failure;
}

/**
 * Whether a tool call that suspended beside the failed one already ended the spans of the segment. Only the failed
 * iteration's steps show it, so the settling engine takes it to the run's own failure as a carried `null` segment.
 */
export function segmentEndedBySuspension(
  segment: SegmentSpanData & { carried?: boolean },
  steps: Record<string, any>,
): boolean {
  const { output, suspendPayload } = steps[DurableStepIds.TOOL_CALL] ?? {};
  const calls = [suspendPayload?.__workflow_meta?.foreachOutput, output].flat() as Array<
    { status?: string } | undefined
  >;
  return (
    calls.some(call => call?.status === 'suspended') &&
    segmentOwnsStep(segment, steps[DurableStepIds.LLM_EXECUTION]?.output?.stepSpanData)
  );
}

/**
 * End what a failed execution left open, from the facts the run carries, where the process that settles the
 * failure may hold none of the run's live spans. An iteration's failure ends its MODEL_STEP; the run's failure
 * ends the MODEL_GENERATION and AGENT_RUN its segment reports under. Never throws.
 */
export function endFailedSegmentSpans({
  mastra,
  requestContext,
  runId,
  state,
  steps,
  error,
  live,
  firstPairOnly,
}: {
  mastra: Mastra | undefined;
  requestContext: RequestContext<any>;
  runId: string;
  /** An iteration's state counts the iterations; the run's input does not. */
  state: { agentSpanData?: unknown; modelSpanData?: unknown; iterationCount?: number };
  steps: Record<string, any>;
  error: Error;
  live?: RunRegistryEntry;
  /** Leave a resumed or recovered pair to the process that opened it. */
  firstPairOnly?: boolean;
}): void {
  try {
    const observability = mastra?.observability?.getSelectedInstance({ requestContext });
    // The finish step ends the pair itself; a later step's failure must not end it again. An engine that threw
    // reports no steps, not even its input, so it can have ended the pair too.
    if (!observability || !('input' in steps) || steps[MAP_FINAL_OUTPUT_STEP_ID]?.status === 'success') return;
    const segment = segmentSpanData(requestContext, runId, state, live);
    const failure = { error, ...executionFailureTermination(error), endSpan: true };
    if (state.iterationCount !== undefined) {
      const stepSpanData = steps[DurableStepIds.LLM_EXECUTION]?.output?.stepSpanData;
      // The mapping step ends the step itself.
      if (!stepSpanData || steps[DurableStepIds.LLM_MAPPING]?.status === 'success') return;
      if (!segmentOwnsStep(segment, stepSpanData) || segmentEndedBySuspension(segment, steps)) return;
      (
        liveSegmentSpan<Span<SpanType.MODEL_STEP>>(stepSpanData, live?.openStepSpan) ??
        observability.rebuildSpan<SpanType.MODEL_STEP>(stepSpanData)
      ).error(stepFailure(failure));
      return;
    }
    if (firstPairOnly && segment.carried) return;
    const { modelSpanData, agentSpanData } = segment;
    if (modelSpanData)
      (
        liveSegmentSpan<Span<SpanType.MODEL_GENERATION>>(modelSpanData, live?.resumeModelSpan, live?.modelSpan) ??
        observability.rebuildSpan(modelSpanData)
      ).error(failure);
    if (agentSpanData)
      (
        liveSegmentSpan(agentSpanData, live?.resumeAgentSpan, live?.agentSpan) ??
        observability.rebuildSpan(agentSpanData)
      ).error(failure);
  } catch {
    // Span bookkeeping must never break settlement.
  }
}
