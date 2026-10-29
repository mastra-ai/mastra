import { createContext, use } from 'react';
import type { UISpan } from '../types';
import { useTraceTimeCursor } from './use-trace-time-cursor';

type CurrentSpanIdAt = (t: number) => string | null;

/** Rows on screen, top to bottom: depth-first, with children only under expanded parents. */
function flattenVisibleRows(spans: UISpan[], expanded: ReadonlySet<string>): UISpan[] {
  return spans.flatMap(span => [
    span,
    ...(expanded.has(span.id) ? flattenVisibleRows(span.spans ?? [], expanded) : []),
  ]);
}

/**
 * Finds the lowest row whose bar the cursor crosses (started and still running at `t`).
 * Every row asks with the same `t`, so the last answer is cached.
 */
export function createCurrentSpanIdAt(spans: UISpan[], expandedSpanIds: string[] = []): CurrentSpanIdAt {
  const rows = flattenVisibleRows(spans, new Set(expandedSpanIds)).map(span => {
    const startMs = Date.parse(span.startTime);
    return { id: span.id, startMs, endMs: span.endTime ? startMs + span.latency : Infinity };
  });
  let lastT: number | undefined;
  let lastId: string | null = null;

  return t => {
    if (t !== lastT) {
      lastT = t;
      lastId = rows.findLast(row => row.startMs <= t && t < row.endMs)?.id ?? null;
    }
    return lastId;
  };
}

export const TimelineCurrentSpanContext = createContext<CurrentSpanIdAt | null>(null);

/** Whether this row is the lowest one the cursor crosses. Flips only when the cursor enters or leaves it. */
export function useIsCurrentTimelineSpan(spanId: string): boolean {
  const currentSpanIdAt = use(TimelineCurrentSpanContext);
  return useTraceTimeCursor(t => t != null && currentSpanIdAt?.(t) === spanId);
}
