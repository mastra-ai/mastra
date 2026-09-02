import { useActiveRunResources } from '../../../../hooks/useActiveRunResources';
import { allSessionRows, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { sessionRowStatus } from '../../workspaces/services/sessionStatus';
import type { SessionRowStatus } from '../../workspaces/services/sessionStatus';
import type { WorkItem } from '../services/workItems';

/**
 * Live status per board card, from the same inputs the sidebar rows read: the
 * shared controller poll and the workspace records. A card waiting on a person
 * speaks through its own status row, not through the wick.
 */
export function useItemSessionStatuses({
  projectRepositoryId,
  items,
}: {
  projectRepositoryId: string;
  items: readonly WorkItem[];
}): ReadonlyMap<string, SessionRowStatus> {
  const boundSessionIds = items.flatMap(item => Object.values(item.sessions ?? {}).map(ref => ref.sessionId));
  const runningBySessionId = useActiveRunResources({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceIds: boundSessionIds,
  });
  const workspaces = useWorkspacesQuery(projectRepositoryId);
  const materializingSessionIds = new Set(
    allSessionRows(workspaces.data)
      .filter(session => !session.materializedAt)
      .map(session => session.sessionId),
  );

  const statuses = new Map<string, SessionRowStatus>();
  for (const item of items) {
    const refs = Object.values(item.sessions ?? {});
    if (refs.length === 0) continue;
    const status = sessionRowStatus({
      running: refs.some(ref => runningBySessionId[ref.sessionId] === true),
      initializing: refs.some(ref => materializingSessionIds.has(ref.sessionId)),
    });
    if (status !== undefined) statuses.set(item.id, status);
  }
  return statuses;
}
