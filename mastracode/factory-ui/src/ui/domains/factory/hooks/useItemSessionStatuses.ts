import { useActiveRunResources } from '../../../../hooks/useActiveRunResources';
import { useWorkspaceAttentionState } from '../../../../hooks/useWorkspaceAttention';
import { useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { sessionRowStatus } from '../../workspaces/services/sessionStatus';
import type { SessionRowStatus } from '../../workspaces/services/sessionStatus';
import type { WorkItem } from '../services/workItems';

/**
 * Live status per board card, from the same inputs the sidebar rows read: the
 * shared controller poll, the workspace records, and the attention marks. One
 * resolution for the whole board — cards render what they are handed.
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
  const { attentionByPath } = useWorkspaceAttentionState({ projectRepositoryId, sessionKind: 'factory' });
  const materializingSessionIds = new Set(
    [...(workspaces.data?.workspaces ?? []), ...(workspaces.data?.userSessions ?? [])]
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
      attention: refs.some(ref => attentionByPath[ref.sessionId] === true),
    });
    if (status !== undefined) statuses.set(item.id, status);
  }
  return statuses;
}
