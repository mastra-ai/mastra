import { useContext } from 'react';

import { ChatThreadMessagesContext } from './ChatThreadMessagesContext';
import { ChatTranscriptContext } from './ChatTranscriptContext';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatMessagePreparation {
  preparing: boolean;
}

/**
 * Content readiness, not status: unlike `chatSessionPhase`, a live run does not
 * clear it — rejoining a running session still waits for its history. Only the
 * thread's history gates it: entering a session provisions nothing, and the
 * messages read does not need the session's metadata, so a transcript that has
 * loaded shows while the rest of the session resolves.
 */
export function useChatMessagePreparation(): ChatMessagePreparation {
  const messages = useContext(ChatThreadMessagesContext);
  if (!messages) throw new Error('useChatMessagePreparation must be used within a ChatSessionBoundary');

  // A deferred boundary renders before the transcript mounts; until then the
  // messages query is the only loading fact there is.
  const transcript = useContext(ChatTranscriptContext);
  const { sessionError } = useChatSessionContext();
  const loadingHistory = transcript ? transcript.loadingHistory : messages.isPending;
  return { preparing: !sessionError && loadingHistory };
}
