import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { queryKeys } from '../../../../../shared/api/keys';
import { useChatConnection } from '../context/useChatConnection';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { createAgentControllerClient } from '../services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useSwitchAgentControllerThreadMutation } from './useAgentControllerThreadMutations';
import { useAgentControllerThreads } from './useAgentControllerThreads';

export function useRouteThreadSync() {
  const { resourceId, sessionEnabled, projectPath, baseUrl, threadBasePath } = useChatSessionContext();
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
  const location = useLocation();
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const { threadId: routeThreadId } = useParams<{ threadId: string }>();
  const latestRouteThreadId = useRef<string | null>(null);

  const switchToRouteThread = useEffectEvent((threadId: string) => {
    latestRouteThreadId.current = threadId;
    const isLatestRequest = () => latestRouteThreadId.current === threadId;

    if (!threadsQuery.data?.some(thread => thread.id === threadId)) {
      const routeMessagesKey = queryKeys.agentControllerThreadMessages(
        AGENT_CONTROLLER_ID,
        resourceId,
        projectPath,
        threadId,
      );
      const routeMessages = queryClient.getQueryData(routeMessagesKey);
      const factoryRunProjectPath = (location.state as { factoryRunProjectPath?: unknown } | null)
        ?.factoryRunProjectPath;
      if (factoryRunProjectPath === projectPath) {
        if (transcript.threadId !== threadId) reset(threadId);
        return;
      }
      if (Array.isArray(routeMessages) && routeMessages.length > 0) {
        if (transcript.threadId !== threadId) reset(threadId);
        void switchThreadMutation
          .mutateAsync(threadId)
          .then(state => {
            if (!isLatestRequest()) return;
            syncState(state);
          })
          .catch(() => {
            // The startup path already seeded the target thread's messages.
            // If the scoped thread list lags behind, keep the route stable and
            // let the next connection/thread-list refresh reconcile state.
          });
        return;
      }

      // The route thread does not exist in the current scope. This is the
      // normal outcome of a worktree switch (threads are scoped per
      // worktree), so settle on the scope's most recent thread instead of
      // bouncing through /new with an error.
      const latest = [...(threadsQuery.data ?? [])].sort((a, b) => {
        const ta = a.updatedAt ?? a.createdAt ?? '';
        const tb = b.updatedAt ?? b.createdAt ?? '';
        return tb.localeCompare(ta);
      })[0];
      if (latest) {
        // Warm the message cache first so the target thread renders content
        // instead of a loading skeleton.
        const warm = session
          ? queryClient.prefetchQuery({
              queryKey: queryKeys.agentControllerThreadMessages(
                AGENT_CONTROLLER_ID,
                resourceId,
                projectPath,
                latest.id,
              ),
              queryFn: () => session.listMessages(latest.id),
            })
          : Promise.resolve();
        void warm.finally(() => {
          if (!isLatestRequest()) return;
          void navigate(`${threadBasePath}/${latest.id}`, { replace: true });
        });
        return;
      }
      reset();
      void navigate('/new', { replace: true });
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
