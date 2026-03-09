import { SpanRecord } from '@mastra/core/storage';

export type ThreadGroup = {
  threadId: string;
  traces: SpanRecord[];
};

export type GroupedTraces = {
  groups: ThreadGroup[];
  ungrouped: SpanRecord[];
};

/**
 * Groups traces by their threadId field.
 * Traces without a threadId are placed in the `ungrouped` bucket.
 * Groups are ordered by the most recent trace's startedAt (descending).
 * Within each group, traces maintain their original order.
 */
export function groupTracesByThread(traces: SpanRecord[]): GroupedTraces {
  const threadMap = new Map<string, SpanRecord[]>();
  const ungrouped: SpanRecord[] = [];

  for (const trace of traces) {
    if (trace.threadId) {
      const existing = threadMap.get(trace.threadId);
      if (existing) {
        existing.push(trace);
      } else {
        threadMap.set(trace.threadId, [trace]);
      }
    } else {
      ungrouped.push(trace);
    }
  }

  const groups: ThreadGroup[] = Array.from(threadMap.entries()).map(([threadId, traces]) => ({
    threadId,
    traces,
  }));

  // Sort groups by the most recent trace in each group (descending)
  groups.sort((a, b) => {
    const aLatest = Math.max(...a.traces.map(t => new Date(t.startedAt).getTime()));
    const bLatest = Math.max(...b.traces.map(t => new Date(t.startedAt).getTime()));
    return bLatest - aLatest;
  });

  return { groups, ungrouped };
}
