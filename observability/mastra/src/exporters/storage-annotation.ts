import type { FeedbackEvent, ScoreEvent } from '@mastra/core/observability';
import type { ObservabilityStorage } from '@mastra/core/storage';
import { resolveRecordedEventFromTrace } from '../recorded';

// Preserve the SDK's retry window for spans that have not reached storage yet.
const LOOKUP_DELAYS_MS = [0, 100, 250, 500, 1000, 2000, 2000];

/** Only storage exporters resolve against attached storage; other destinations receive the original event. */
export async function resolveStorageAnnotation(
  event: ScoreEvent | FeedbackEvent,
  storage: ObservabilityStorage,
  flushSpans: () => Promise<void>,
): Promise<ScoreEvent | FeedbackEvent | null> {
  const record = event.type === 'score' ? event.score : event.feedback;
  if (record.correlationContext !== undefined) return event;
  if (!record.traceId) return null;

  for (const delay of LOOKUP_DELAYS_MS) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    const trace = await storage.getTrace({ traceId: record.traceId });
    const resolved = trace ? resolveRecordedEventFromTrace(trace, event) : null;
    if (resolved) return resolved;
    if (delay === 0) await flushSpans();
  }
  return null;
}
