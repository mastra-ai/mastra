import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useParams } from 'react-router';

import { useDocumentTitle } from '../../../../hooks/useDocumentTitle';
import { useAgentControllerThreads } from '../../../../hooks/useAgentControllerThreads';
import { useRouteSessionId } from '../../../../hooks/useRouteSessionId';
import { updateCachedSessionTitle } from '../../../../hooks/useWorkspaces';
import { useSessionCard } from '../../factory/hooks/useSessionCard';
import { useSessionRepository } from '../../factory/hooks/useSessionRepository';
import { workItemReference } from '../../factory/services/relationships';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useChatSessionContext } from '../context/useChatSessionContext';

/** Tab title for the open thread: the session card's reference (`PR #1567`, `ENG-123`), else the thread title. */
export function PageTitle() {
  const { factoryId, threadId } = useParams<{ factoryId?: string; threadId?: string }>();
  const { sessionId: chatSessionId, threadTags, baseUrl, resourceReady } = useChatSessionContext();
  const queryClient = useQueryClient();
  const routeSessionId = useRouteSessionId();
  const { item } = useSessionCard();
  const { repository } = useSessionRepository();

  const threadsQuery = useAgentControllerThreads({
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId: chatSessionId,
    threadTags,
    baseUrl,
    enabled: resourceReady,
  });

  const reference = item && workItemReference(item, repository?.slug);
  const threadTitle = threadsQuery.data?.find(thread => thread.id === threadId)?.title?.trim();

  useEffect(() => {
    if (!routeSessionId || !threadTitle) return;
    void updateCachedSessionTitle(queryClient, factoryId, routeSessionId, threadTitle);
  }, [factoryId, queryClient, routeSessionId, threadTitle]);

  useDocumentTitle(reference ?? threadTitle);
  return null;
}
