import { Notice } from '@mastra/playground-ui/components/Notice';

import { useSendAgentControllerMessageMutation } from '../../../../hooks/useAgentControllerRunMutations';
import { useChatConnection } from '../context/useChatConnection';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';

const CONTINUE_PROMPT = 'Continue from where you stopped.';

export function RunErrorContinueButton() {
  const { sessionId, baseUrl, sessionEnabled } = useChatSessionContext();
  const transcript = useChatTranscript();
  const { status } = useChatConnection();
  const sendMessage = useSendAgentControllerMessageMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  });
  // A send before the live subscription is ready loses the run's completion events.
  const blocked = transcript.busy || transcript.initializing || status !== 'ready' || sendMessage.isPending;
  const continueRun = async () => {
    if (blocked) return;
    const localId = transcript.localUser(CONTINUE_PROMPT);
    try {
      await sendMessage.mutateAsync(CONTINUE_PROMPT);
    } catch (error) {
      transcript.failLocalUser(localId);
      transcript.clearPending();
      transcript.pushNotice(error instanceof Error ? error.message : 'The run could not be continued.', 'error');
    }
  };
  return (
    <Notice.Button onClick={() => void continueRun()} disabled={blocked}>
      Continue
    </Notice.Button>
  );
}
