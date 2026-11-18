/**
 * Which AGENT_RUN + MODEL_GENERATION pair a durable execution reports under.
 *
 * A segment is one execution of the durable loop: the run's start, or a resume or a recovery, up
 * to its suspension or its end. Each segment has its own span pair and ends its own spans once.
 */
import type { ExportedSpan, SpanType } from '../../observability';

export interface SegmentSpanData {
  agentSpanData?: ExportedSpan<SpanType.AGENT_RUN>;
  modelSpanData?: ExportedSpan<SpanType.MODEL_GENERATION>;
}

/**
 * Whether `segment` may end the MODEL_STEP `stepSpanData`: one opened under its own
 * MODEL_GENERATION. A step opened by the segment that suspended was ended by that suspension, so
 * the segment that finishes its tool call leaves it alone.
 */
export function segmentOwnsStep(segment: SegmentSpanData, stepSpanData: unknown): boolean {
  const parent = (stepSpanData as { parentSpanId?: unknown } | undefined)?.parentSpanId;
  return parent === segment.modelSpanData?.id;
}
