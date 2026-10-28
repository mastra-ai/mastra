import { Button } from '@mastra/playground-ui/components/Button';
import { useIsMutating } from '@tanstack/react-query';

import { useSendAgentControllerMessageMutation } from '../../../../hooks/useAgentControllerRunMutations';
import { switchThreadMutationKey } from '../../../../hooks/useAgentControllerThreadMutations';
import { useChatConnection } from '../context/useChatConnection';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';

const CONTINUE_PROMPT = 'Continue from where you stopped.';

export function ContinueRunAction({ entryId }: { entryId: string }) {
  const { sessionId, baseUrl, sessionEnabled } = useChatSessionContext();
  const transcript = useChatTranscript();
  const { status, threadId: boundThreadId } = useChatConnection();
  const sendMessage = useSendAgentControllerMessageMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  });
  // The server can rebind before a switch's response lands, so the acknowledged binding is unknown until then.
  const switchingThread = useIsMutating({ mutationKey: switchThreadMutationKey(AGENT_CONTROLLER_ID, sessionId) }) > 0;
  const latestFailure = transcript.transcript.entries.at(-1)?.id === entryId;
  // A message goes to the bound thread, which lags the displayed one while a thread switch is in flight.
  const displayedThreadIsBound = boundThreadId !== undefined && transcript.transcript.threadId === boundThreadId;
  if (!sessionEnabled || !latestFailure || !displayedThreadIsBound) return null;

  // A send before the live subscription is ready loses the run's completion events.
  const blocked =
    transcript.busy || transcript.initializing || status !== 'ready' || switchingThread || sendMessage.isPending;
  const continueRun = async () => {
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
    <Button variant="ghost" size="sm" disabled={blocked} onClick={() => void continueRun()}>
      Continue
    </Button>
  );
}
