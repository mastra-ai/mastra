import { useParams } from 'react-router';

import { useDocumentTitle } from '../../../../hooks/useDocumentTitle';
import { useAgentControllerThreads } from '../../../../hooks/useAgentControllerThreads';
import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { workItemIdentifier } from '../../factory/services/relationships';
import type { WorkItem } from '../../factory/services/workItems';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useChatSessionContext } from '../context/useChatSessionContext';

function identifierForThread(workItems: WorkItem[] | undefined, sessionId?: string, threadId?: string) {
  if (!sessionId || !threadId) return undefined;
  const item = workItems?.find(candidate =>
    Object.values(candidate.sessions).some(session => session.sessionId === sessionId && session.threadId === threadId),
  );
  return item ? workItemIdentifier(item) : undefined;
}

/**
 * Drives `document.title` for the current thread: the linked work item's
 * canonical identifier (`#1567` on GitHub, `ENG-123` on Linear), else the
 * thread's own title, else the default app title while data loads — so a wall
 * of session tabs stays identifiable without flickering through placeholders.
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

  const identifier = identifierForThread(workItems.data, sessionId, threadId);
  const threadTitle = threadsQuery.data?.find(thread => thread.id === threadId)?.title?.trim();

  useDocumentTitle(identifier ?? threadTitle);
  return null;
}
