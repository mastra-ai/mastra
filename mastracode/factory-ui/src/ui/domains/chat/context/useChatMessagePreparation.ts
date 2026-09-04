import { useContext } from 'react';

import { ChatThreadMessagesContext } from './ChatThreadMessagesContext';
import { ChatTranscriptContext } from './ChatTranscriptContext';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatMessagePreparation {
  historyInitializing: boolean;
  preparing: boolean;
}

/**
 * Content readiness, not status: unlike `chatSessionPhase`, a live run does not
 * clear it — rejoining a running session still shows the prepare stepper.
 */
export function useChatMessagePreparation(): ChatMessagePreparation {
  const messages = useContext(ChatThreadMessagesContext);
  if (!messages) throw new Error('useChatMessagePreparation must be used within a ChatSessionBoundary');

  // A deferred boundary renders before the transcript mounts; until then the
  // messages query is the only loading fact there is.
  const transcript = useContext(ChatTranscriptContext);
  const { sessionError, sandboxPreparing } = useChatSessionContext();
  const initializing = transcript ? transcript.initializing : sandboxPreparing || messages.isPending;
  return {
    historyInitializing: transcript?.historyInitializing ?? false,
    preparing: !sessionError && initializing,
  };
}
