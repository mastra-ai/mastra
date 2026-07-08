import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

interface ChatThreadMessagesValue {
  messagesPending: boolean;
}

const ChatThreadMessagesContext = createContext<ChatThreadMessagesValue | null>(null);

/**
 * Exposes the thread-history fetch status to the message list without routing
 * it through `ChatSessionApi` — only the transcript panel cares about the
 * loading skeleton, so it gets its own context seam.
 */
export function ChatThreadMessagesProvider({
  children,
  messagesPending,
}: {
  children: ReactNode;
  messagesPending: boolean;
}) {
  return (
    <ChatThreadMessagesContext.Provider value={{ messagesPending }}>{children}</ChatThreadMessagesContext.Provider>
  );
}

export function useThreadMessages(): ChatThreadMessagesValue {
  const ctx = useContext(ChatThreadMessagesContext);
  if (!ctx) throw new Error('useThreadMessages must be used within a ChatThreadMessagesProvider');
  return ctx;
}
