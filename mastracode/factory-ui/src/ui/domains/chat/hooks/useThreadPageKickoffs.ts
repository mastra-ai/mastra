import { useEffect, useRef } from 'react';
import { useParams } from 'react-router';

import { useSendAgentControllerMessageMutation } from '../../../../hooks/useAgentControllerRunMutations';
import { useChatConnection } from '../context/useChatConnection';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { claimThreadPageKickoffs } from '../services/threadPageReadiness';

export function useThreadPageKickoffs(): void {
  const { status, threadId: activeThreadId } = useChatConnection();
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const { localUser, clearPending, pushNotice } = useChatTranscript();
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
    if (status === 'error') {
      const kickoffs = claimThreadPageKickoffs(key);
      if (kickoffs.length === 0) return;
      const connectionError = new Error('The session failed to come online. Reconnect, then send the message again.');
      for (const kickoff of kickoffs) {
        if (!kickoff.echoed) localUser(kickoff.message);
        kickoff.fail(connectionError);
      }
      clearPending();
      pushNotice(connectionError.message, 'error');
      return;
    }
    if (status !== 'ready' || activeThreadId !== routeThreadId) return;
    const kickoffs = claimThreadPageKickoffs(key);
    for (const kickoff of kickoffs) {
      if (!kickoff.echoed) localUser(kickoff.message);
      pendingKickoffs.current += 1;
    }

    void (async () => {
      for (const kickoff of kickoffs) {
        try {
          await sendMessage.mutateAsync(kickoff.message);
          kickoff.complete();
        } catch (error) {
          const dispatchError = error instanceof Error ? error : new Error('Factory kickoff dispatch failed');
          kickoff.fail(dispatchError);
          pushNotice(dispatchError.message, 'error');
        } finally {
          pendingKickoffs.current -= 1;
          if (pendingKickoffs.current === 0) clearPending();
        }
      }
    })();
  }, [
    activeThreadId,
    clearPending,
    localUser,
    projectPath,
    pushNotice,
    resourceId,
    routeThreadId,
    sendMessage,
    status,
  ]);
}
