import { Notice } from '@mastra/playground-ui/components/Notice';

import { useSendAgentControllerMessageMutation } from '../../../../hooks/useAgentControllerRunMutations';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';

export function RunErrorContinueButton() {
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const transcript = useChatTranscript();
  const send = useSendAgentControllerMessageMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const continueRun = async () => {
    if (transcript.busy || send.isPending) return;
    const text = 'Continue from where you stopped.';
    const localId = transcript.localUser(text);
    try {
      await send.mutateAsync(text);
    } catch (error) {
      transcript.failLocalUser(localId);
      transcript.clearPending();
      transcript.pushNotice(error instanceof Error ? error.message : 'The run could not be continued.', 'error');
    }
  };
  return (
    <Notice.Button onClick={continueRun} disabled={transcript.busy || send.isPending}>
      Continue
    </Notice.Button>
  );
}
