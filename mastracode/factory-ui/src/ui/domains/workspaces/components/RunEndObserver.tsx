import { useEffect } from 'react';

import { useActiveRunResources } from '../../../../hooks/useActiveRunResources';
import { allSessionRows, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { playDoneSound } from '../../settings/services/doneSound';

const runningBySession = new Map<string, boolean>();

export function resetRunEndSoundForTests(): void {
  runningBySession.clear();
}

/** Rings this tab's done sound when a run it watched in flight ends. */
export function RunEndSoundObserver({ projectRepositoryId }: { projectRepositoryId: string | undefined }) {
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
    if (runEnded) playDoneSound();
  }, [running]);
  return null;
}
