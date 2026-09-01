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
 * The write side of the derivation: baseline unknown sessions, absorb run
 * ends the viewer is watching happen (the open session never advertises a
 * mark — the reader is already there), and ring once per run end across every
 * open tab. The done sound still plays for the open session, calling back a
 * backgrounded tab.
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
    const now = new Date().toISOString();
    const seen = seenSnapshot();

    const unknown = sessions.filter(session => seen[session.sessionId] === undefined).map(session => session.sessionId);
    if (unknown.length > 0) markSessionsSeen(unknown, now);

    for (const session of sessions) {
      const endedAt = session.lastRunEndedAt;
      if (!endedAt) continue;
      const previous = lastObservedRunEnd.get(session.sessionId);
      lastObservedRunEnd.set(session.sessionId, endedAt);
      // Ring only for an end this tab watched land; a reload replays history silently.
      if (previous !== undefined && previous < endedAt) {
        void playAttentionSoundOnce(`run:${session.sessionId}`, endedAt);
      }
    }

    if (openSessionId) {
      const openStamp = sessions.find(session => session.sessionId === openSessionId)?.lastRunEndedAt;
      // Absorb to the stamp, and only when a new end needs it: an
      // unconditional write would re-notify subscribers every render and
      // never converge.
      if (openStamp && (seen[openSessionId] ?? '') < openStamp) markSessionsSeen([openSessionId], openStamp);
    }
  }, [sessions, openSessionId, ready]);
}
