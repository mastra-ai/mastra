import { useEffect } from 'react';
import { useSessionHost } from '../context/SessionHostContext';

import { useDocumentTitle } from '../../../../hooks/useDocumentTitle';
import { useAgentControllerThreads } from '../../../../hooks/useAgentControllerThreads';
import { useRouteSessionId } from '../../../../hooks/useRouteSessionId';
import { workItemReference } from '@mastra/playground-ui/domains/factory';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useChatSessionContext } from '../context/useChatSessionContext';

const noSessionCard = () => ({ item: undefined });
const noSessionRepository = () => ({ repository: undefined });

/** Tab title for the open thread: the session card's reference (`PR #1567`, `ENG-123`), else the thread title. */
export function PageTitle() {
  const { factoryProjectId: factoryId, threadId, data } = useSessionHost();
  const useSessionCard = data.useSessionCard ?? noSessionCard;
  const useSessionRepository = data.useSessionRepository ?? noSessionRepository;
  const { sessionId: chatSessionId, threadTags, baseUrl, resourceReady } = useChatSessionContext();
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
    void data.onSessionTitleChanged(factoryId, routeSessionId, threadTitle);
  }, [data, factoryId, routeSessionId, threadTitle]);

  useDocumentTitle(reference ?? threadTitle);
  return null;
}
