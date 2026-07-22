import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../api/keys';
import { useChatConnection } from '../../web/ui/domains/chat/context/useChatConnection';
import { useChatSessionContext } from '../../web/ui/domains/chat/context/useChatSessionContext';
import { useChatTranscript } from '../../web/ui/domains/chat/context/useChatTranscript';
import { createAgentControllerClient } from '../../web/ui/domains/chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../web/ui/domains/chat/services/constants';
import { useSwitchAgentControllerThreadMutation } from './useAgentControllerThreadMutations';
import { useAgentControllerThreads } from './useAgentControllerThreads';

export function useRouteThreadSync() {
  const { resourceId, sessionEnabled, baseUrl } = useChatSessionContext();
  const { status, threadId } = useChatConnection();
  const { pushNotice } = useChatTranscript();
  const threadsQuery = useAgentControllerThreads({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    baseUrl,
    enabled: sessionEnabled,
  });
  const switchThreadMutation = useSwitchAgentControllerThreadMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    baseUrl,
    enabled: sessionEnabled,
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    baseUrl,
    enabled: sessionEnabled,
  });
  const { factoryId, threadId: routeThreadId } = useParams<{ factoryId: string; threadId: string }>();
  const latestRouteThreadId = useRef<string | undefined>(undefined);
  const previousSessionKey = useRef<string | undefined>(undefined);
  const sessionKey = resourceId;

  const switchToRouteThread = useEffectEvent((targetThreadId: string, fallbackForScopeChange: boolean) => {
    latestRouteThreadId.current = targetThreadId;
    const isLatestRequest = () => latestRouteThreadId.current === targetThreadId;

    if (!threadsQuery.data?.some(thread => thread.id === targetThreadId)) {
      const latest = [...(threadsQuery.data ?? [])].sort((a, b) => {
        const ta = a.updatedAt ?? a.createdAt ?? '';
        const tb = b.updatedAt ?? b.createdAt ?? '';
        return tb.localeCompare(ta);
      })[0];

      if (fallbackForScopeChange && latest) {
        const warm = session
          ? queryClient.prefetchQuery({
              queryKey: queryKeys.agentControllerThreadMessages(
                AGENT_CONTROLLER_ID,
                resourceId,
                latest.id,
                INITIAL_THREAD_MESSAGE_LIMIT,
              ),
              queryFn: () => session.listMessages(latest.id, INITIAL_THREAD_MESSAGE_LIMIT),
            })
          : Promise.resolve();
        void warm.finally(() => {
          if (isLatestRequest()) void navigate(`/factories/${factoryId}/threads/${latest.id}`, { replace: true });
        });
        return;
      }

      const message = `Failed to switch thread: thread ${targetThreadId} was not found`;
      pushNotice(message, 'error');
      void navigate(`/factories/${factoryId}/new`, { replace: true, state: { routeErrorNotice: message } });
      return;
    }

    void switchThreadMutation.mutateAsync(targetThreadId).catch(err => {
      if (!isLatestRequest()) return;
      const message = `Failed to switch thread: ${err instanceof Error ? err.message : String(err)}`;
      pushNotice(message, 'error');
      void navigate(`/factories/${factoryId}/new`, { replace: true, state: { routeErrorNotice: message } });
    });
  });

  useEffect(() => {
    const sessionKeyChanged = previousSessionKey.current !== undefined && previousSessionKey.current !== sessionKey;
    previousSessionKey.current = sessionKey;
    latestRouteThreadId.current = routeThreadId;
    if (!routeThreadId || status !== 'ready' || !threadsQuery.isSuccess) return;
    if (threadId === routeThreadId) return;
    switchToRouteThread(routeThreadId, sessionKeyChanged);
  }, [routeThreadId, sessionKey, status, threadId, threadsQuery.isSuccess, threadsQuery.data]);
}
