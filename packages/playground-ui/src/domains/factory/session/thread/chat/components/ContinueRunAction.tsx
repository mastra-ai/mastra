import { useChatConnection } from '../context/useChatConnection';

import { useChatSessionActions } from '../context/useChatSessionActions';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { Button } from '@/ds/components/Button';

const CONTINUE_PROMPT = 'Continue from where you stopped.';

export function ContinueRunAction({ entryId }: { entryId: string }) {
  const { sessionEnabled } = useChatSessionContext();
  const transcript = useChatTranscript();
  const { status, threadId: boundThreadId } = useChatConnection();
  const { send, sending, switchingThread } = useChatSessionActions();
  const latestFailure =
    transcript.transcript.entries.findLast(entry => entry.kind !== 'notice' || entry.error !== undefined)?.id ===
    entryId;
  // A message goes to the bound thread, which lags the displayed one while a thread switch is in flight.
  const displayedThreadIsBound = boundThreadId !== undefined && transcript.transcript.threadId === boundThreadId;
  if (!sessionEnabled || !latestFailure || !displayedThreadIsBound) return null;

  // A send before the live subscription is ready loses the run's completion events.
  const blocked = transcript.busy || transcript.initializing || status !== 'ready' || switchingThread || sending;
  const continueRun = async () => {
    const localId = transcript.localUser(CONTINUE_PROMPT);
    try {
      await send(CONTINUE_PROMPT);
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
