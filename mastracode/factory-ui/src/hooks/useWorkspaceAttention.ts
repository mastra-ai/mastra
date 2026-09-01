import { useEffect, useSyncExternalStore } from 'react';

import { playAttentionSoundOnce } from '../ui/domains/factory/services/attentionSound';
import { markSessionsSeen, seenSnapshot, subscribeSeen } from '../ui/domains/workspaces/services/sessionSeen';

interface SessionRunStamp {
  sessionId: string;
  lastRunEndedAt?: string | null;
}

/**
 * Attention derives from two durable facts — the server's `lastRunEndedAt`
 * stamp and the viewer's seen store — so a reload, a hidden tab, or a run
 * shorter than any poll interval cannot lose a mark. A session the store has
 * never seen is baselined by the observer instead of marked: runs that ended
 * before this viewer ever watched the list are history, not news.
 */
export function useSessionAttentionMarks(sessions: readonly SessionRunStamp[]): Record<string, true> {
  const seen = useSyncExternalStore(subscribeSeen, seenSnapshot);
  const marks: Record<string, true> = {};
  for (const session of sessions) {
    const endedAt = session.lastRunEndedAt;
    if (!endedAt) continue;
    const seenAt = seen[session.sessionId];
    if (seenAt !== undefined && seenAt < endedAt) marks[session.sessionId] = true;
  }
  return marks;
}

// Module-level so remounts (route changes) do not replay a ring for a stamp
// this tab already watched land.
const lastObservedRunEnd = new Map<string, string>();

/** Test-only: forget which stamps this tab has already seen land. */
export function resetRunObserverForTests(): void {
  lastObservedRunEnd.clear();
}

/**
 * The write side of the derivation: baseline unknown sessions at their current
 * stamp, absorb the open session's run ends as they land (the reader is already
 * there, so it never advertises a mark), and ring once per run end across every
 * open tab — the open session included, calling back a backgrounded tab.
 */
export function useSessionRunObserver({
  sessions,
  openSessionId,
  ready,
}: {
  sessions: readonly SessionRunStamp[];
  openSessionId: string | undefined;
  ready: boolean;
}): void {
  useEffect(() => {
    if (!ready) return;
    const seen = seenSnapshot();
    const absorbed: Record<string, string> = {};
    for (const { sessionId, lastRunEndedAt } of sessions) {
      const endedAt = lastRunEndedAt ?? '';
      if (seen[sessionId] === undefined || sessionId === openSessionId) absorbed[sessionId] = endedAt;
      const previous = lastObservedRunEnd.get(sessionId);
      lastObservedRunEnd.set(sessionId, endedAt);
      // Ring only for an end this tab watched land; a reload replays history silently.
      if (previous !== undefined && previous < endedAt) void playAttentionSoundOnce(`run:${sessionId}`, endedAt);
    }
    markSessionsSeen(absorbed);
  }, [sessions, openSessionId, ready]);
}
