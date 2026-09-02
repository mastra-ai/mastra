import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryKeys } from '../../../../api/keys';
import { useActiveRunResources } from '../../../../hooks/useActiveRunResources';
import { allSessionRows, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { playDoneSound } from '../../settings/services/doneSound';

const runningBySession = new Map<string, boolean>();

export function resetRunEndObserverForTests(): void {
  runningBySession.clear();
}

/** A run this tab watched in flight ended: ring the done sound, refetch the sessions list it may have materialized. */
export function RunEndObserver({ projectRepositoryId }: { projectRepositoryId: string | undefined }) {
  const queryClient = useQueryClient();
  const { data } = useWorkspacesQuery(projectRepositoryId);
  const running = useActiveRunResources({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceIds: allSessionRows(data).map(session => session.sessionId),
  });

  useEffect(() => {
    let runEnded = false;
    for (const [sessionId, isRunning] of Object.entries(running)) {
      if (runningBySession.get(sessionId) === true && !isRunning) runEnded = true;
      runningBySession.set(sessionId, isRunning);
    }
    if (!runEnded) return;
    playDoneSound();
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(projectRepositoryId) });
  }, [running, queryClient, projectRepositoryId]);

  return null;
}
