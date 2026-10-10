import { TTLCache } from '@isaacs/ttlcache';
import type { MastraDBMessage } from '../message-list';
import { MemoryMessageRefs } from '../message-list/memory-message-refs';

/**
 * Messages each run knows memory storage holds — recalled ones it verified and
 * ones it saved itself — shared by every step this process runs for it. Losing
 * an entry only costs a storage read (or keeps saved messages inline until the
 * next save).
 */
const runMessageRefs = new TTLCache<string, MemoryMessageRefs>({
  max: 1000,
  ttl: 10 * 60 * 1000,
  updateAgeOnGet: true,
});

export function getRunMessageRefs(runId: string | undefined): MemoryMessageRefs {
  let refs = runId ? runMessageRefs.get(runId) : undefined;
  if (!refs) {
    refs = new MemoryMessageRefs();
    if (runId) runMessageRefs.set(runId, refs);
  }
  return refs;
}

/** The run's refs if this process holds them, without creating an entry. */
export function peekRunMessageRefs(runId: string | undefined): MemoryMessageRefs | undefined {
  return runId ? runMessageRefs.get(runId) : undefined;
}

export function releaseRunMessageRefs(runId: string | undefined): void {
  if (runId) runMessageRefs.delete(runId);
}

/**
 * A `SaveQueueManager` `onSaved` callback that records the rows a run saved,
 * so its persisted transcript references them instead of repeating them. Only
 * runs that store refs hold an entry (the transcript store creates it), so saves
 * for other runs, or landing after the run released its entry, are not kept.
 */
export function recordRunSavedMessages(runId: string): (rows: MastraDBMessage[]) => void {
  return rows => {
    const refs = peekRunMessageRefs(runId);
    if (!refs) return;
    const byThread = new Map<string, MastraDBMessage[]>();
    for (const row of rows) {
      if (!row.threadId) continue;
      const key = `${row.threadId}\u0000${row.resourceId ?? ''}`;
      byThread.set(key, [...(byThread.get(key) ?? []), row]);
    }
    for (const threadRows of byThread.values()) {
      const { threadId, resourceId } = threadRows[0]!;
      refs.recordSaved(threadRows, { threadId: threadId!, resourceId });
    }
  };
}
