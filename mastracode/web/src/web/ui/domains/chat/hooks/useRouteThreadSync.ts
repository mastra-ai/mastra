import { useEffect, useEffectEvent, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useChatConnection } from '../context/useChatConnection';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useSwitchAgentControllerThreadMutation } from './useAgentControllerThreadMutations';
import { useAgentControllerThreads } from './useAgentControllerThreads';

export function useRouteThreadSync() {
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const { status, state } = useChatConnection();
  const { transcript, reset, syncState, pushNotice } = useChatTranscript();
  const threadsQuery = useAgentControllerThreads({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const switchThreadMutation = useSwitchAgentControllerThreadMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const navigate = useNavigate();
  const { threadId: routeThreadId } = useParams<{ threadId: string }>();
  const latestRouteThreadId = useRef<string | null>(null);

  const switchToRouteThread = useEffectEvent((threadId: string) => {
    latestRouteThreadId.current = threadId;
    const isLatestRequest = () => latestRouteThreadId.current === threadId;

    if (!threadsQuery.data?.some(thread => thread.id === threadId)) {
      const message = `Failed to switch thread: thread ${threadId} was not found`;
      reset();
      pushNotice(message, 'error');
      void navigate('/new', { replace: true, state: { routeErrorNotice: message } });
      return;
    }

    if (transcript.threadId !== threadId) reset(threadId);
    void switchThreadMutation
      .mutateAsync(threadId)
      .then(state => {
        if (!isLatestRequest()) return;
        syncState(state);
      })
      .catch(err => {
        if (!isLatestRequest()) return;
        const message = `Failed to switch thread: ${err instanceof Error ? err.message : String(err)}`;
        reset();
        pushNotice(message, 'error');
        void navigate('/new', { replace: true, state: { routeErrorNotice: message } });
      });
  });

  useEffect(() => {
    latestRouteThreadId.current = routeThreadId ?? null;
    if (!routeThreadId) return;
    if (status !== 'ready' || !threadsQuery.isSuccess) return;
    if (!threadsQuery.data?.some(thread => thread.id === routeThreadId)) {
      switchToRouteThread(routeThreadId);
      return;
    }
    if (state?.threadId === routeThreadId && transcript.threadId === routeThreadId) return;
    switchToRouteThread(routeThreadId);
  }, [routeThreadId, status, state?.threadId, transcript.threadId, threadsQuery.isSuccess, threadsQuery.data]);
}
