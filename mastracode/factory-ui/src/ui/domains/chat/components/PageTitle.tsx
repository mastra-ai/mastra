import { useParams } from 'react-router';

import { useDocumentTitle } from '../../../../hooks/useDocumentTitle';
import { useAgentControllerThreads } from '../../../../hooks/useAgentControllerThreads';
import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { workItemIdentifier } from '../../factory/services/relationships';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useChatSessionContext } from '../context/useChatSessionContext';

/**
 * Drives `document.title` for the current thread.
 *
 * - Sessions linked to an external work item → the item's canonical identifier
 *   (`#1567` for GitHub PRs and issues, `ENG-123` for Linear) so tab titles
 *   sort at a glance next to a stack of numbered work.
 * - Everything else (user sessions, sessions with no linked work item) → the
 *   thread's own title.
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

  const identifier = (() => {
    if (!sessionId || !threadId) return undefined;
    const item = workItems.data?.find(candidate =>
      Object.values(candidate.sessions).some(
        session => session.sessionId === sessionId && session.threadId === threadId,
      ),
    );
    return item ? workItemIdentifier(item) : undefined;
  })();

  const threadTitle = threadsQuery.data?.find(thread => thread.id === threadId)?.title?.trim();

  const title = identifier ?? threadTitle ?? undefined;

  useDocumentTitle(title);
  return null;
}
