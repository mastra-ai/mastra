/**
 * RecordedTraceImpl - A trace loaded from storage with tree structure
 * and annotation capabilities.
 *
 * Provides both tree access (rootSpan with children) and flat access
 * (spans array). Both reference the same RecordedSpan objects.
 */

import type {
  RecordedTrace,
  AnyRecordedSpan,
  AnyExportedSpan,
  ScoreInput,
  FeedbackInput,
  ExportedScore,
  ExportedFeedback,
  ScoreEvent,
  FeedbackEvent,
} from '@mastra/core/observability';

import type { ObservabilityBus } from '../bus';

import { RecordedSpanImpl } from './recorded-span';

export class RecordedTraceImpl implements RecordedTrace {
  constructor(
    public readonly traceId: string,
    public readonly rootSpan: AnyRecordedSpan,
    public readonly spans: ReadonlyArray<AnyRecordedSpan>,
    private spanMap: Map<string, AnyRecordedSpan>,
    private bus: ObservabilityBus,
  ) {}

  getSpan(spanId: string): AnyRecordedSpan | null {
    return this.spanMap.get(spanId) ?? null;
  }

  addScore(score: ScoreInput): void {
    const exportedScore: ExportedScore = {
      timestamp: new Date(),
      traceId: this.traceId,
      spanId: undefined,
      scorerName: score.scorerName,
      score: score.score,
      reason: score.reason,
      experimentId: score.experimentId,
      metadata: {
        ...this.rootSpan.metadata,
        ...score.metadata,
      },
    };

    const event: ScoreEvent = { type: 'score', score: exportedScore };
    this.bus.emit(event);
  }

  addFeedback(feedback: FeedbackInput): void {
    const exportedFeedback: ExportedFeedback = {
      timestamp: new Date(),
      traceId: this.traceId,
      spanId: undefined,
      source: feedback.source,
      feedbackType: feedback.feedbackType,
      value: feedback.value,
      comment: feedback.comment,
      experimentId: feedback.experimentId,
      metadata: {
        ...this.rootSpan.metadata,
        userId: feedback.userId,
        ...feedback.metadata,
      },
    };

    const event: FeedbackEvent = { type: 'feedback', feedback: exportedFeedback };
    this.bus.emit(event);
  }
}

/**
 * Build a RecordedTrace from a flat list of ExportedSpan objects.
 *
 * Constructs the parent-child tree and returns a RecordedTraceImpl
 * with both tree and flat access to the same span objects.
 */
export function buildRecordedTrace(
  traceId: string,
  exportedSpans: AnyExportedSpan[],
  bus: ObservabilityBus,
): RecordedTrace {
  // 1. Create RecordedSpan objects
  const spanMap = new Map<string, RecordedSpanImpl>();
  for (const exported of exportedSpans) {
    spanMap.set(exported.id, new RecordedSpanImpl(exported, bus));
  }

  // 2. Wire up parent/children references
  for (const span of spanMap.values()) {
    if (span.parentSpanId) {
      const parent = spanMap.get(span.parentSpanId);
      if (parent) {
        span._setParent(parent);
        parent._addChild(span);
      }
    }
  }

  // 3. Find root span (use isRootSpan flag, not unresolved parent ref)
  const rootSpan = [...spanMap.values()].find(s => s.isRootSpan);
  if (!rootSpan) {
    throw new Error(`No root span found for trace ${traceId}`);
  }

  // 4. Build flat array (same objects as tree)
  const spans = [...spanMap.values()];

  return new RecordedTraceImpl(traceId, rootSpan, spans, spanMap as Map<string, AnyRecordedSpan>, bus);
}
