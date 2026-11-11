import type { FeedbackEvent, ScoreEvent } from '@mastra/core/observability';
import type { ObservabilityStorage } from '@mastra/core/storage';
import { resolveRecordedEventFromTrace } from '../recorded';

// Preserve the SDK's retry window for spans that have not reached storage yet.
const LOOKUP_DELAYS_MS = [0, 100, 250, 500, 1000, 2000, 2000];

/**
 * Resolve attached-storage context within a bounded retry window, including failed reads.
 * Exhaustion returns null for missing anchors or throws the last read error for the exporter to report.
 * Other destinations receive the original event independently.
 */
export async function resolveStorageAnnotation(
  event: ScoreEvent | FeedbackEvent,
  storage: ObservabilityStorage,
  flushSpans: () => Promise<void>,
): Promise<ScoreEvent | FeedbackEvent | null> {
  const record = event.type === 'score' ? event.score : event.feedback;
  if (record.correlationContext !== undefined) return event;
  if (!record.traceId) return null;

  let lastReadFailure: { error: unknown } | undefined;
  for (const delay of LOOKUP_DELAYS_MS) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    let trace;
    try {
      trace = await storage.getTrace({ traceId: record.traceId });
      lastReadFailure = undefined;
    } catch (error) {
      lastReadFailure = { error };
    }
    if (trace) {
      const resolved = resolveRecordedEventFromTrace(trace, event);
      if (resolved) return resolved;
    }
    if (delay === 0) await flushSpans();
  }
  if (lastReadFailure) throw lastReadFailure.error;
  return null;
}
