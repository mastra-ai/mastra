import { Notice } from '@mastra/playground-ui/components/Notice';

import { useSendAgentControllerMessageMutation } from '../../../../hooks/useAgentControllerRunMutations';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';

const CONTINUE_PROMPT = 'Continue from where you stopped.';

export function RunErrorContinueButton() {
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const transcript = useChatTranscript();
  const sendMessage = useSendAgentControllerMessageMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const blocked = transcript.busy || sendMessage.isPending;
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
