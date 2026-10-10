import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';

/**
 * The current head of `origin`'s lineage (the generations reflections have created from it),
 * or `null` when that lineage is gone.
 *
 * Use this instead of reading the head by thread/resource when committing work that started
 * from `origin`. Clearing a record (`om.clear`, `Memory.deleteThread`) deletes every generation
 * of the thread/resource, and the thread can then get a new, unrelated record. Work produced
 * from the cleared messages must never be committed to it.
 *
 * Generation ids are never reused and clearing deletes all of them, so the head belongs to
 * `origin`'s lineage iff `origin` still exists.
 */
export async function getLineageHead(
  storage: MemoryStorage,
  origin: Pick<ObservationalMemoryRecord, 'id' | 'threadId' | 'resourceId' | 'generationCount'>,
): Promise<ObservationalMemoryRecord | null> {
  const head = await storage.getObservationalMemory(origin.threadId, origin.resourceId);
  if (!head || head.id === origin.id) return head;
  // Each reflection adds one generation, so a head descended from `origin` is newer than it.
  if (head.generationCount <= origin.generationCount) return null;
  // Newest first; the lineage's generations from the head back to `origin`, with slack for
  // duplicate rows left by older versions.
  const history = await storage.getObservationalMemoryHistory(
    origin.threadId,
    origin.resourceId,
    head.generationCount - origin.generationCount + 3,
  );
  return history.some(record => record.id === origin.id) ? head : null;
}

/**
 * The generation `id` of `origin`'s lineage, or `null` when that lineage is gone or `id` is not
 * part of it. Unlike {@link getLineageHead}, this keeps naming `id` after later reflections have
 * superseded it, e.g. to report which generation a write landed on.
 */
export async function getLineageRecord(
  storage: MemoryStorage,
  origin: Pick<ObservationalMemoryRecord, 'id' | 'threadId' | 'resourceId' | 'generationCount'>,
  id: string,
): Promise<ObservationalMemoryRecord | null> {
  const head = await getLineageHead(storage, origin);
  if (!head || head.id === id) return head;
  const history = await storage.getObservationalMemoryHistory(
    origin.threadId,
    origin.resourceId,
    head.generationCount - origin.generationCount + 3,
  );
  return history.find(record => record.id === id) ?? null;
}
