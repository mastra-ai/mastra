import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useSendAgentControllerMessageMutation } from '../../../../hooks/useAgentControllerRunMutations';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';

/** Router state handing the prompt that created a session to the thread page it opens. */
export function promptHandoffState(prompt: string): { handoffPrompt: string } {
  return { handoffPrompt: prompt };
}

function readHandoffPrompt(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('handoffPrompt' in state)) return null;
  const { handoffPrompt } = state;
  return typeof handoffPrompt === 'string' && handoffPrompt ? handoffPrompt : null;
}

/**
 * Sends the prompt that created this session. The controller holds the message
 * until the workspace finishes preparing, so it needs no client-side queue.
 */
export function useHandoffPrompt(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const { localUser, clearPending, pushNotice } = useChatTranscript();
  const sendMessage = useSendAgentControllerMessageMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const handedOff = useRef(false);
  const prompt = readHandoffPrompt(location.state);

  useEffect(() => {
    if (!prompt || !sessionEnabled || handedOff.current) return;
    handedOff.current = true;
    // history state outlives a reload; drop it before sending so the prompt cannot go twice
    void navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    localUser(prompt);
    void sendMessage.mutateAsync(prompt).catch(error => {
      clearPending();
      pushNotice(error instanceof Error ? error.message : 'The message could not be sent.', 'error');
    });
  }, [
    clearPending,
    localUser,
    location.pathname,
    location.search,
    navigate,
    prompt,
    pushNotice,
    sendMessage,
    sessionEnabled,
  ]);
}
