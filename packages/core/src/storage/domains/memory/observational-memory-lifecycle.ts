import type { ObservationalMemoryRecord, UpdateActiveObservationsResult } from '../../types';

/**
 * Shared rules for observational memory lifecycle writes. Every storage adapter applies
 * these inside its own atomic section (lock, transaction, or conditional update), so the
 * decisions are identical across adapters.
 */

/**
 * Canonical head order: `generationCount DESC, createdAt ASC, id ASC`.
 * Returns a negative number when `a` sorts before `b` (i.e. `a` is the better head candidate).
 */
export function compareObservationalMemoryHeadOrder(
  a: Pick<ObservationalMemoryRecord, 'generationCount' | 'createdAt' | 'id'>,
  b: Pick<ObservationalMemoryRecord, 'generationCount' | 'createdAt' | 'id'>,
): number {
  if (a.generationCount !== b.generationCount) return b.generationCount - a.generationCount;
  const at = new Date(a.createdAt).getTime();
  const bt = new Date(b.createdAt).getTime();
  if (at !== bt) return at - bt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * A buffered chunk stores `lastObservedAt = max message time + 1ms`. It is wholly covered
 * (every message it observed is already at or before the cursor) iff
 * `cursor >= chunk.lastObservedAt - 1ms`.
 */
export function isBufferedChunkCoveredByCursor(
  chunkLastObservedAt: Date | string,
  cursor: Date | string | null | undefined,
): boolean {
  if (!cursor) return false;
  return new Date(cursor).getTime() >= new Date(chunkLastObservedAt).getTime() - 1;
}

/** The later of two cursors; `undefined` only when both are absent. */
export function maxObservationCursor(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined,
): Date | undefined {
  if (!a) return b ? new Date(b) : undefined;
  if (!b) return new Date(a);
  return new Date(Math.max(new Date(a).getTime(), new Date(b).getTime()));
}

export interface ReflectionTextPlan {
  /** `equal`: stored text equals the snapshot. `append`: observations were appended after the snapshot. */
  mode: 'equal' | 'append';
  observations: string;
  tokenCount: number;
}

/**
 * Decide the new generation's text when a reflection built from `snapshot` commits against
 * the stored record.
 *
 * - Stored text equals the snapshot: the reflection replaces it.
 * - Stored text extends the snapshot (activation only appends): the appended tail is kept
 *   after the reflection, and its tokens are added.
 * - Anything else (a non-append rewrite): `null` — the reflection must not be applied.
 */
export function planReflectionGenerationText(input: {
  storedObservations: string;
  storedObservationTokenCount: number;
  snapshotObservations: string;
  snapshotObservationTokenCount: number;
  reflection: string;
  tokenCount: number;
}): ReflectionTextPlan | null {
  const stored = input.storedObservations ?? '';
  const snapshot = input.snapshotObservations ?? '';
  if (stored === snapshot) {
    return { mode: 'equal', observations: input.reflection, tokenCount: input.tokenCount };
  }
  if (!stored.startsWith(snapshot)) return null;
  const tail = stored.slice(snapshot.length).trimStart();
  if (!tail.trim()) {
    return { mode: 'equal', observations: input.reflection, tokenCount: input.tokenCount };
  }
  return {
    mode: 'append',
    observations: input.reflection ? `${input.reflection}\n\n${tail}` : tail,
    tokenCount:
      input.tokenCount +
      Math.max(0, (input.storedObservationTokenCount ?? 0) - (input.snapshotObservationTokenCount ?? 0)),
  };
}

/**
 * Backs `updateActiveObservations` in adapters that implement `commitActiveObservations`.
 * Callers of `updateActiveObservations` (which resolves `void`) can't see a commit result, so a
 * write that was not applied throws instead of resolving as if it had committed.
 */
export function assertActiveObservationsApplied(result: UpdateActiveObservationsResult, id: string): void {
  if (result.applied) return;
  throw new Error(
    result.reason === 'retired'
      ? `Observational memory record ${id} was superseded by a newer generation; observations were not written`
      : `Observational memory record ${id} changed since the observations were composed; observations were not written`,
  );
}

/**
 * Whether the stored text can still accept a reflection built from `snapshot`
 * (equal, or only appended to since).
 */
export function isAppendOnlySince(storedObservations: string, snapshotObservations: string): boolean {
  const stored = storedObservations ?? '';
  const snapshot = snapshotObservations ?? '';
  return stored === snapshot || stored.startsWith(snapshot);
}
