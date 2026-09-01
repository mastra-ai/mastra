import { useEffect } from 'react';

import { allSessionRows, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { playAttentionSoundOnce } from '../../factory/services/attentionSound';

// Module-level so remounts (route changes) do not replay a ring for a stamp
// this tab already watched land.
const lastObservedRunEnd = new Map<string, string>();

/** Test-only: forget which stamps this tab has already seen land. */
export function resetRunEndSoundForTests(): void {
  lastObservedRunEnd.clear();
}

/**
 * Rings once per run end this tab watches land, deduplicated across open tabs
 * and including the open session, so a backgrounded tab is called back. A stamp
 * already there at mount is history: a reload replays nothing.
 */
export function RunEndSoundObserver({ projectRepositoryId }: { projectRepositoryId: string | undefined }) {
  const { data, isSuccess } = useWorkspacesQuery(projectRepositoryId);
  useEffect(() => {
    if (!isSuccess) return;
    for (const { sessionId, lastRunEndedAt } of allSessionRows(data)) {
      const endedAt = lastRunEndedAt ?? '';
      const previous = lastObservedRunEnd.get(sessionId);
      lastObservedRunEnd.set(sessionId, endedAt);
      if (previous !== undefined && previous < endedAt) void playAttentionSoundOnce(`run:${sessionId}`, endedAt);
    }
  }, [data, isSuccess]);
  return null;
}
