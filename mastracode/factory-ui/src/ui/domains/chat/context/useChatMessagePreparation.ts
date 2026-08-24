import { useContext } from 'react';

import { ChatThreadMessagesContext } from './ChatThreadMessagesContext';
import { ChatTranscriptContext } from './ChatTranscriptContext';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatMessagePreparation {
  historyInitializing: boolean;
  preparing: boolean;
}

export function useChatMessagePreparation(): ChatMessagePreparation {
  const messages = useContext(ChatThreadMessagesContext);
  if (!messages) throw new Error('useChatMessagePreparation must be used within a ChatSessionBoundary');

  const transcript = useContext(ChatTranscriptContext);
  const { sessionError, sandboxPreparing, sandboxWarming } = useChatSessionContext();
  const threadFailed = Boolean(messages.threadId && messages.error);
  const messagesInitializing = Boolean(messages.threadId) && messages.isPending;
  const historyInitializing =
    Boolean(messages.threadId) && !threadFailed && transcript !== null && !transcript.initialHistoryReady;
  const emptyIdleWarming =
    sandboxWarming === true && transcript !== null && transcript.transcript.entries.length === 0 && !transcript.busy;

  // One state prevents the loader from flickering or resetting between parallel startup work.
  return {
    historyInitializing,
    preparing: !sessionError && (sandboxPreparing || messagesInitializing || historyInitializing || emptyIdleWarming),
  };
}
