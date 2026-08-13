import { useParams } from 'react-router';

import { useDocumentTitle } from '../../../../hooks/useDocumentTitle';
import { useAgentControllerThreads } from '../../../../hooks/useAgentControllerThreads';
import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { workItemNumber } from '../../factory/services/relationships';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useChatSessionContext } from '../context/useChatSessionContext';

/**
 * Drives `document.title` for the current thread.
 *
 * - PR-backed factory sessions → `#<pr-number>` so tabs headlining reviews
 *   read at a glance next to a stack of numbered PRs.
 * - Everything else (user sessions, issue-backed work sessions, sessions with
 *   no linked work item) → the thread's own title.
 *
 * The hook falls back to the default app title while data is still loading or
 * when no signal is available yet, so tab titles never flicker through
 * placeholders. Mounted only inside a resolved session, so unmounting on
 * navigation restores the default title automatically.
 */
export function PageTitle() {
  const { factoryId, sessionId, threadId } = useParams<{
    factoryId?: string;
    sessionId?: string;
    threadId?: string;
  }>();
  const { resourceId, projectPath, baseUrl, resourceReady } = useChatSessionContext();

  const workItems = useWorkItemsQuery(factoryId);

  const threadsQuery = useAgentControllerThreads({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: resourceReady,
  });

  const prNumber = (() => {
    if (!sessionId || !threadId) return undefined;
    const item = workItems.data?.find(candidate =>
      Object.values(candidate.sessions).some(
        session => session.sessionId === sessionId && session.threadId === threadId,
      ),
    );
    if (item?.source !== 'github-pr') return undefined;
    return workItemNumber(item);
  })();

  const threadTitle = threadsQuery.data?.find(thread => thread.id === threadId)?.title?.trim();

  const title = prNumber ? `#${prNumber}` : (threadTitle ?? undefined);

  useDocumentTitle(title);
  return null;
}
