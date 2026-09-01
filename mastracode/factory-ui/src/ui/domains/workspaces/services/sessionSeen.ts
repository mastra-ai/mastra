/**
 * The viewer's half of the attention derivation: when they last absorbed each
 * session's run ends. The server's `lastRunEndedAt` is the other half — a mark
 * shows exactly while the stamp is newer than this store, so marks survive
 * reloads and dismiss across tabs without any stored mark state.
 */

const SEEN_KEY = 'mastracode.sessionSeen.v1';
const MAX_SEEN_SESSIONS = 500;

type SeenBySessionId = Record<string, string>;

let snapshot: SeenBySessionId | undefined;
const listeners = new Set<() => void>();

function readStore(): SeenBySessionId {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
}

export function seenSnapshot(): SeenBySessionId {
  snapshot ??= readStore();
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

/** Advance the seen time for these sessions; entries already at or past `at` keep their later value. */
export function markSessionsSeen(sessionIds: readonly string[], at: string): void {
  const current = seenSnapshot();
  const advancing = sessionIds.filter(sessionId => (current[sessionId] ?? '') < at);
  if (advancing.length === 0) return;
  write({ ...current, ...Object.fromEntries(advancing.map(sessionId => [sessionId, at])) });
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
