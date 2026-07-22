import { useEffect, useRef } from 'react';
import { useParams } from 'react-router';

import { useSendAgentControllerMessageMutation } from '../../../../../shared/hooks/useAgentControllerRunMutations';
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
    if (status !== 'ready' || !routeThreadId || activeThreadId !== routeThreadId) return;
    const kickoffs = claimThreadPageKickoffs({ resourceId, projectPath, threadId: routeThreadId });
    for (const kickoff of kickoffs) {
      localUser(kickoff.message);
      pendingKickoffs.current += 1;
      void sendMessage.mutateAsync(kickoff.message).then(
        () => {
          pendingKickoffs.current -= 1;
          kickoff.complete();
        },
        error => {
          pendingKickoffs.current -= 1;
          if (pendingKickoffs.current === 0) clearPending();
          const dispatchError = error instanceof Error ? error : new Error('Factory kickoff dispatch failed');
          kickoff.fail(dispatchError);
          pushNotice(dispatchError.message, 'error');
        },
      );
    }
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
