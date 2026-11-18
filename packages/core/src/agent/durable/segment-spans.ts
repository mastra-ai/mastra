/**
 * Which AGENT_RUN + MODEL_GENERATION pair a durable execution reports under.
 *
 * A segment is one execution of the durable loop: the run's start, or a resume or a recovery, up
 * to its suspension or its end. Each segment has its own span pair and ends its own spans once.
 * The run's first pair travels in the workflow input. A resume or recovery opens the next pair and
 * carries it on the request context, which every engine hands to every step and persists with the
 * run, so the worker that finishes a segment ends that segment's spans wherever it runs.
 */
import type { ExportedSpan, SpanType } from '../../observability';
import type { RequestContext } from '../../request-context';
import { MASTRA_DURABLE_SEGMENTS_KEY } from '../request-context-snapshot';

export interface SegmentSpanData {
  agentSpanData?: ExportedSpan<SpanType.AGENT_RUN>;
  modelSpanData?: ExportedSpan<SpanType.MODEL_GENERATION>;
  /** Recovery: the MODEL_GENERATION the crashed segment left a MODEL_STEP open under. */
  adoptsStepsOf?: string;
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
 * means the execution opened no spans, so its steps end none.
 */
export function segmentSpanData(
  requestContext: Pick<RequestContext, 'getRaw'> | undefined,
  runId: string,
  state: { agentSpanData?: unknown; modelSpanData?: unknown },
): SegmentSpanData {
  const carried = readCarrier(requestContext, runId);
  if (carried === null) return {};
  return (
    carried ?? {
      agentSpanData: state.agentSpanData as ExportedSpan<SpanType.AGENT_RUN> | undefined,
      modelSpanData: state.modelSpanData as ExportedSpan<SpanType.MODEL_GENERATION> | undefined,
    }
  );
}

/** The live span behind `data` when this process holds it, so it is ended in place; otherwise undefined. */
export function liveSegmentSpan<S extends { id: string }>(
  data: { id: string } | undefined,
  ...candidates: Array<S | undefined>
): S | undefined {
  return data ? candidates.find(span => span?.id === data.id) : undefined;
}

/**
 * Whether `segment` may end the MODEL_STEP `stepSpanData`: one opened under its own
 * MODEL_GENERATION, or the one the segment it recovered left open. A step opened by the segment
 * that suspended was ended by that suspension, so the segment that finishes its tool call leaves
 * it alone.
 */
export function segmentOwnsStep(segment: SegmentSpanData, stepSpanData: unknown): boolean {
  const parent = (stepSpanData as { parentSpanId?: unknown } | undefined)?.parentSpanId;
  return (
    parent === segment.modelSpanData?.id || (segment.adoptsStepsOf !== undefined && parent === segment.adoptsStepsOf)
  );
}
