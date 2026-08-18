import { useContext } from 'react';

import { ChatThreadMessagesContext } from './ChatThreadMessagesContext';

/** True when the thread's message history failed to load — what `ChatMessageBoundary` turns into a notice. */
export function useChatMessagesError(): boolean {
  const messages = useContext(ChatThreadMessagesContext);
  return Boolean(messages?.threadId && messages.error);
}
