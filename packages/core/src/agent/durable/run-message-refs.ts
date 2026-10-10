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

export function releaseRunMessageRefs(runId: string | undefined): void {
  if (runId) runMessageRefs.delete(runId);
}

/**
 * A `SaveQueueManager` `onSaved` callback that records the rows a run saved,
 * so its persisted transcript references them instead of repeating them.
 */
export function recordRunSavedMessages(runId: string): (rows: MastraDBMessage[]) => void {
  return rows => {
    const byThread = new Map<string, MastraDBMessage[]>();
    for (const row of rows) {
      if (!row.threadId) continue;
      const key = `${row.threadId}\u0000${row.resourceId ?? ''}`;
      byThread.set(key, [...(byThread.get(key) ?? []), row]);
    }
    const refs = getRunMessageRefs(runId);
    for (const threadRows of byThread.values()) {
      const { threadId, resourceId } = threadRows[0]!;
      refs.recordSaved(threadRows, { threadId: threadId!, resourceId });
    }
  };
}
