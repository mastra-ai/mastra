import { readStoredStringRecord } from '../../../lib/storedStringRecord';

/**
 * The viewer's half of the attention derivation: the latest run end they have
 * absorbed per session, held as the server's own `lastRunEndedAt` stamp so the
 * viewer's clock never enters the comparison. A mark shows exactly while the
 * stamp is newer than this store, so marks survive reloads and dismiss across
 * tabs without any stored mark state.
 */

const SEEN_KEY = 'mastracode.sessionSeen.v1';
const MAX_SEEN_SESSIONS = 500;

/** Session id → the absorbed `lastRunEndedAt`; `''` for a session seen before it ever ran. */
type SeenBySessionId = Record<string, string>;

let snapshot: SeenBySessionId | undefined;
const listeners = new Set<() => void>();

export function seenSnapshot(): SeenBySessionId {
  snapshot ??= readStoredStringRecord(SEEN_KEY);
  return snapshot;
}

function notify(): void {
  for (const listener of [...listeners]) listener();
}

function write(next: SeenBySessionId): void {
  const bounded = Object.entries(next)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .slice(-MAX_SEEN_SESSIONS);
  snapshot = Object.fromEntries(bounded);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(snapshot));
  } catch {
    // A blocked store still serves this tab from memory.
  }
  notify();
}

/** Absorb each session's run ends up to its stamp; an entry never moves backwards. */
export function markSessionsSeen(seenUpTo: Readonly<SeenBySessionId>): void {
  const current = seenSnapshot();
  const advancing = Object.entries(seenUpTo).filter(([sessionId, at]) => {
    const absorbed = current[sessionId];
    return absorbed === undefined || absorbed < at;
  });
  if (advancing.length === 0) return;
  write({ ...current, ...Object.fromEntries(advancing) });
}

export function subscribeSeen(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test-only: drop the in-memory snapshot so the next read hits localStorage. */
export function resetSeenForTests(): void {
  snapshot = undefined;
}

// Another tab dismissing a mark (or absorbing a run end) lands here as a
// storage event, so every tab's marks agree without a refetch.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key !== SEEN_KEY) return;
    snapshot = undefined;
    notify();
  });
}
