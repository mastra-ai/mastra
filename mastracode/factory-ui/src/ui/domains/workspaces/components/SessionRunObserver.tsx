import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { queryKeys } from '../../../../api/keys';
import { useActiveRunResourceIds } from '../../../../hooks/useActiveRunResources';
import { allSessionRows, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { playDoneSound } from '../../settings/services/doneSound';

const runningBySession = new Map<string, boolean>();

export function resetSessionRunObserverForTests(): void {
  runningBySession.clear();
}

/**
 * The run registry is the one poll that sees a session the dispatcher created before this tab listed it:
 * a run on an unlisted session refetches the list once; a watched run ending rings the done sound and refetches too.
 */
export function SessionRunObserver({ projectRepositoryId }: { projectRepositoryId: string | undefined }) {
  const queryClient = useQueryClient();
  const { data } = useWorkspacesQuery(projectRepositoryId);
  const activeRunResourceIds = useActiveRunResourceIds(AGENT_CONTROLLER_ID);
  const [refetchedUnlistedRuns] = useState(() => new Set<string>());

  useEffect(() => {
    if (!data) return;
    const listed = new Set(allSessionRows(data).map(session => session.sessionId));
    let runEnded = false;
    for (const sessionId of listed) {
      const isRunning = activeRunResourceIds.has(sessionId);
      if (runningBySession.get(sessionId) === true && !isRunning) runEnded = true;
      runningBySession.set(sessionId, isRunning);
    }
    let unlistedRunStarted = false;
    for (const resourceId of activeRunResourceIds) {
      if (listed.has(resourceId) || refetchedUnlistedRuns.has(resourceId)) continue;
      refetchedUnlistedRuns.add(resourceId);
      unlistedRunStarted = true;
    }
    if (runEnded) playDoneSound();
    if (runEnded || unlistedRunStarted) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(projectRepositoryId) });
    }
  }, [activeRunResourceIds, data, refetchedUnlistedRuns, queryClient, projectRepositoryId]);

  return null;
}
