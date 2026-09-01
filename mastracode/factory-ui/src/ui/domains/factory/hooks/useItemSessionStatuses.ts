import { useActiveRunResources } from '../../../../hooks/useActiveRunResources';
import { useWorkspaceAttentionState } from '../../../../hooks/useWorkspaceAttention';
import { useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import type { SessionCardStatus } from '../../workspaces/components/SessionActivity';
import { sessionRowStatus } from '../../workspaces/services/sessionStatus';
import type { WorkItem } from '../services/workItems';

/**
 * One live status per card, from the same inputs the sidebar rows read. A card
 * watches every session bound to it — each role keeps its own session, so the
 * newest ref alone can miss the one actually running. A ref the workspaces
 * listing does not know yet still counts as bound: dispatcher-minted sessions
 * reach the item before any sidebar refetch sees them.
 */
export function useItemSessionStatuses({
  projectRepositoryId,
  items,
}: {
  projectRepositoryId: string;
  items: readonly WorkItem[];
}): ReadonlyMap<string, SessionCardStatus> {
  const boundSessionIds = items.flatMap(item => Object.values(item.sessions).map(ref => ref.sessionId));
  const runningBySessionId = useActiveRunResources({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceIds: boundSessionIds,
  });
  const workspaces = useWorkspacesQuery(projectRepositoryId);
  const { attentionByPath } = useWorkspaceAttentionState({ projectRepositoryId, sessionKind: 'factory' });
  const materializingSessionIds = new Set(
    [...(workspaces.data?.workspaces ?? []), ...(workspaces.data?.userSessions ?? [])]
      .filter(session => !session.materializedAt)
      .map(session => session.sessionId),
  );

  const statuses = new Map<string, SessionCardStatus>();
  for (const item of items) {
    const refs = Object.values(item.sessions);
    if (refs.length === 0) continue;
    const status = sessionRowStatus({
      running: refs.some(ref => runningBySessionId[ref.sessionId] === true),
      initializing: refs.some(ref => materializingSessionIds.has(ref.sessionId)),
      attention: refs.some(ref => attentionByPath[ref.sessionId] === true),
    });
    statuses.set(item.id, status ?? 'idle');
  }
  return statuses;
}
