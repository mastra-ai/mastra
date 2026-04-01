import type { LogRecord } from '../../types';
import type { UISpan } from './types';

/**
 * Converts LogRecord[] (filtered by traceId) into hierarchical UISpan[] for the timeline.
 *
 * Since LogRecord doesn't have the full span hierarchy (no parentSpanId, startedAt/endedAt pairs),
 * we group logs by spanId and create a flat list of spans sorted by timestamp.
 * Each unique spanId becomes a UISpan with its earliest and latest log timestamps as start/end.
 */
export function formatLogsAsSpans(logs: LogRecord[]): UISpan[] {
  if (!logs || logs.length === 0) {
    return [];
  }

  const spanMap = new Map<
    string,
    {
      id: string;
      name: string;
      type: string;
      earliest: number;
      latest: number;
      earliestIso: string;
      latestIso: string;
    }
  >();

  for (const log of logs) {
    const spanId = log.spanId ?? `log-${logs.indexOf(log)}`;
    const ts = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
    const tsMs = ts.getTime();
    const tsIso = ts.toISOString();

    const existing = spanMap.get(spanId);
    if (existing) {
      if (tsMs < existing.earliest) {
        existing.earliest = tsMs;
        existing.earliestIso = tsIso;
      }
      if (tsMs > existing.latest) {
        existing.latest = tsMs;
        existing.latestIso = tsIso;
      }
    } else {
      spanMap.set(spanId, {
        id: spanId,
        name: log.entityName ?? log.entityType ?? spanId,
        type: log.entityType ?? 'other',
        earliest: tsMs,
        latest: tsMs,
        earliestIso: tsIso,
        latestIso: tsIso,
      });
    }
  }

  const spans: UISpan[] = [];
  for (const entry of spanMap.values()) {
    spans.push({
      id: entry.id,
      name: entry.name,
      type: entry.type,
      latency: entry.latest - entry.earliest,
      startTime: entry.earliestIso,
      endTime: entry.latestIso,
      spans: [],
      parentSpanId: null,
    });
  }

  spans.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return spans;
}
