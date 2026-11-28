import { useEffect } from 'react';
import { useRouteSessionId, useSessionHost } from '../context/SessionHostContext';

import { useChatSessionActions } from '../context/useChatSessionActions';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { workItemReference } from '@/domains/factory';

const noSessionCard = () => ({ item: undefined });
const noSessionRepository = () => ({ repository: undefined });

/** Tab title for the open thread: the session card's reference (`PR #1567`, `ENG-123`), else the thread title. */
export function PageTitle() {
  const { factoryProjectId: factoryId, threadId, data } = useSessionHost();
  const useSessionCard = data.useSessionCard ?? noSessionCard;
  const useSessionRepository = data.useSessionRepository ?? noSessionRepository;
  const routeSessionId = useRouteSessionId();
  const { item } = useSessionCard();
  const { repository } = useSessionRepository();

  const { threads } = useChatSessionActions();

  const reference = item && workItemReference(item, repository?.slug);
  const threadTitle = threads?.list?.find(thread => thread.id === threadId)?.title?.trim();

  useEffect(() => {
    if (!routeSessionId || !threadTitle) return;
    void data.onSessionTitleChanged(factoryId, routeSessionId, threadTitle);
  }, [data, factoryId, routeSessionId, threadTitle]);

  useDocumentTitle(reference ?? threadTitle);
  return null;
}
