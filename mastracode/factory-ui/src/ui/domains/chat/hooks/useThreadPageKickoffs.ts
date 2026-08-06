import { useEffect, useRef } from 'react';
import { useParams } from 'react-router';

import { useSendAgentControllerMessageMutation } from '../../../../hooks/useAgentControllerRunMutations';
import { useChatConnection } from '../context/useChatConnection';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { adoptThreadPageKickoffEchoes, claimThreadPageKickoffs } from '../services/threadPageReadiness';

export function useThreadPageKickoffs(): void {
  const { status, threadId: activeThreadId } = useChatConnection();
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const { localUser, clearPending, pushNotice, instanceId } = useChatTranscript();
  const { threadId: routeThreadId } = useParams();
  const sendMessage = useSendAgentControllerMessageMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const pendingKickoffs = useRef(0);

  useEffect(() => {
    if (!routeThreadId) return;
    const key = { resourceId, projectPath, threadId: routeThreadId };
    for (const message of adoptThreadPageKickoffEchoes(key, instanceId)) {
      localUser(message);
    }
    if (status === 'error') {
      const kickoffs = claimThreadPageKickoffs(key);
      if (kickoffs.length === 0) return;
      const connectionError = new Error('The session failed to come online. Reconnect, then send the message again.');
      for (const kickoff of kickoffs) {
        kickoff.fail(connectionError);
      }
      clearPending();
      pushNotice(connectionError.message, 'error');
      return;
    }
    if (status !== 'ready' || activeThreadId !== routeThreadId) return;
    const kickoffs = claimThreadPageKickoffs(key);
    pendingKickoffs.current += kickoffs.length;

    void (async () => {
      for (const kickoff of kickoffs) {
        try {
          await sendMessage.mutateAsync(kickoff.message);
          pendingKickoffs.current -= 1;
          kickoff.complete();
        } catch (error) {
          pendingKickoffs.current -= 1;
          if (pendingKickoffs.current === 0) clearPending();
          const dispatchError = error instanceof Error ? error : new Error('Factory kickoff dispatch failed');
          kickoff.fail(dispatchError);
          pushNotice(dispatchError.message, 'error');
        }
      }
    })();
  }, [
    activeThreadId,
    clearPending,
    instanceId,
    localUser,
    projectPath,
    pushNotice,
    resourceId,
    routeThreadId,
    sendMessage,
    status,
  ]);
}
