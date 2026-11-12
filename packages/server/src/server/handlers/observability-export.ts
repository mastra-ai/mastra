import { contextFields } from '@internal/core/storage';
import type { Mastra } from '@mastra/core/mastra';
import type {
  CorrelationContext,
  FeedbackEvent,
  FeedbackReplacementEvent,
  FeedbackReviewStatusEvent,
  ScoreEvent,
} from '@mastra/core/observability';
import type { CreateFeedbackRecord, CreateScoreRecord } from '@mastra/core/storage';

function correlationContext(record: CreateFeedbackRecord | CreateScoreRecord): CorrelationContext {
  // An explicit object (even empty) preserves provided mode without remote resolution.
  return Object.fromEntries(
    Object.keys(contextFields).flatMap(key => {
      const value = record[key as keyof typeof record];
      return value == null ? [] : [[key === 'executionSource' ? 'source' : key, value]];
    }),
  );
}

export function persistedScoreEvent(record: CreateScoreRecord & { scoreId: string }): ScoreEvent {
  return {
    type: 'score',
    score: {
      scoreId: record.scoreId,
      timestamp: record.timestamp,
      traceId: record.traceId ?? undefined,
      spanId: record.spanId ?? undefined,
      scorerId: record.scorerId,
      scorerName: record.scorerName ?? undefined,
      scorerVersion: record.scorerVersion ?? undefined,
      scoreSource: record.scoreSource ?? record.source ?? undefined,
      score: record.score,
      reason: record.reason ?? undefined,
      scoreTraceId: record.scoreTraceId ?? undefined,
      correlationContext: correlationContext(record),
      metadata: record.metadata ?? undefined,
    },
  };
}

export function persistedFeedbackEvent(record: CreateFeedbackRecord & { feedbackId: string }): FeedbackEvent {
  return {
    type: 'feedback',
    feedback: {
      feedbackId: record.feedbackId,
      timestamp: record.timestamp,
      traceId: record.traceId ?? undefined,
      spanId: record.spanId ?? undefined,
      feedbackSource: record.feedbackSource ?? record.source ?? undefined,
      feedbackType: record.feedbackType,
      value: record.value,
      feedbackUserId: record.feedbackUserId ?? null,
      comment: record.comment ?? undefined,
      sourceId: record.sourceId ?? undefined,
      reviewStatus: record.reviewStatus ?? 'needs-review',
      correlationContext: correlationContext(record),
      metadata: record.metadata ?? undefined,
    },
  };
}

/** Local persistence has succeeded; an exporter failure must not turn that success into an HTTP error. */
export async function exportPersistedEvent(
  mastra: Mastra,
  event: ScoreEvent | FeedbackEvent | FeedbackReplacementEvent | FeedbackReviewStatusEvent,
): Promise<void> {
  try {
    await mastra.observability.__exportPersistedEvent?.(event);
  } catch (error) {
    mastra
      .getLogger()
      .error('Failed to notify exporters of persisted feedback/score', { error, eventType: event.type });
  }
}
