/** Minimal trace shape required by groupTracesByThread */
export type GroupableTrace = {
  threadId?: string | null;
  createdAt: Date | string;
};

export type ThreadGroup<T extends GroupableTrace = GroupableTrace> = {
  threadId: string;
  traces: T[];
};

export type GroupedTraces<T extends GroupableTrace = GroupableTrace> = {
  groups: ThreadGroup<T>[];
  ungrouped: T[];
};

/**
 * Groups traces by their threadId field.
 * Traces without a threadId are placed in the `ungrouped` bucket.
 * Groups are ordered by the most recent trace's createdAt (descending).
 * Within each group, traces maintain their original order.
 */
export function groupTracesByThread<T extends GroupableTrace>(traces: T[]): GroupedTraces<T> {
  const threadMap = new Map<string, T[]>();
  const ungrouped: T[] = [];

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

  const groups: ThreadGroup<T>[] = Array.from(threadMap.entries()).map(([threadId, traces]) => ({
    threadId,
    traces,
  }));

  // Sort groups by the most recent trace in each group (descending)
  groups.sort((a, b) => {
    const aLatest = Math.max(...a.traces.map(t => new Date(t.createdAt).getTime()));
    const bLatest = Math.max(...b.traces.map(t => new Date(t.createdAt).getTime()));
    return bLatest - aLatest;
  });

  return { groups, ungrouped };
}
