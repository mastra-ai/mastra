import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../api/keys';
import { useChatConnection } from '../ui/domains/chat/context/useChatConnection';
import { useChatSessionContext } from '../ui/domains/chat/context/useChatSessionContext';
import { useChatTranscript } from '../ui/domains/chat/context/useChatTranscript';
import { createAgentControllerClient } from '../ui/domains/chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../ui/domains/chat/services/constants';
import { useSwitchAgentControllerThreadMutation } from './useAgentControllerThreadMutations';
import { useAgentControllerThreads } from './useAgentControllerThreads';

export function useRouteThreadSync() {
  const { resourceId, sessionEnabled, resourceReady, projectPath, baseUrl } = useChatSessionContext();
  const { status, threadId } = useChatConnection();
  const { pushNotice } = useChatTranscript();
  const threadsQuery = useAgentControllerThreads({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: resourceReady,
  });
  const switchThreadMutation = useSwitchAgentControllerThreadMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    // Thread-switch is a mutation that talks to the sandbox — keep it on
    // sandboxReady (= sessionEnabled) so it never fires before session
    // metadata resolves.
    enabled: sessionEnabled,
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    // The session client is used for prefetch reads (listMessages) inside the
    // fallback-for-scope-change branch — safe to build as soon as the resource
    // is addressable.
    enabled: resourceReady,
  });
  const { factoryId, threadId: routeThreadId } = useParams<{ factoryId: string; threadId: string }>();
  const latestRouteThreadId = useRef<string | undefined>(undefined);
  const previousSessionKey = useRef<string | undefined>(undefined);
  const sessionKey = `${resourceId}:${projectPath ?? ''}`;

  const switchToRouteThread = useEffectEvent((targetThreadId: string, fallbackForScopeChange: boolean) => {
    latestRouteThreadId.current = targetThreadId;
    const isLatestRequest = () => latestRouteThreadId.current === targetThreadId;

    if (!threadsQuery.data?.some(thread => thread.id === targetThreadId)) {
      const latest = [...(threadsQuery.data ?? [])].sort((a, b) => {
        const ta = a.updatedAt ?? '';
        const tb = b.updatedAt ?? '';
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
    latestRouteThreadId.current = routeThreadId;
    if (!sessionEnabled || status !== 'ready' || !threadsQuery.isSuccess) return;
    const sessionKeyChanged = previousSessionKey.current !== undefined && previousSessionKey.current !== sessionKey;
    previousSessionKey.current = sessionKey;
    if (!routeThreadId || threadId === routeThreadId) return;
    switchToRouteThread(routeThreadId, sessionKeyChanged);
  }, [routeThreadId, sessionEnabled, sessionKey, status, threadId, threadsQuery.isSuccess, threadsQuery.data]);
}
