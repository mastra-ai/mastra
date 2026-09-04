import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useParams } from 'react-router';

import { useDocumentTitle } from '../../../../hooks/useDocumentTitle';
import { useAgentControllerThreads } from '../../../../hooks/useAgentControllerThreads';
import { updateCachedSessionTitle } from '../../../../hooks/useWorkspaces';
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

/** Tab title for the open thread: the linked work item's identifier (`#1567`, `ENG-123`), else the thread title. */
export function PageTitle() {
  const { factoryId, sessionId, threadId } = useParams<{
    factoryId?: string;
    sessionId?: string;
    threadId?: string;
  }>();
  const { resourceId, projectPath, baseUrl, resourceReady, factorySessionState } = useChatSessionContext();
  const queryClient = useQueryClient();
  const projectRepositoryId = factorySessionState?.projectRepositoryId;
  const routeSessionId = sessionId ?? threadId;

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

  useEffect(() => {
    if (!routeSessionId || !threadTitle) return;
    void updateCachedSessionTitle(queryClient, projectRepositoryId, routeSessionId, threadTitle);
  }, [projectRepositoryId, queryClient, routeSessionId, threadTitle]);

  useDocumentTitle(identifier ?? threadTitle);
  return null;
}
