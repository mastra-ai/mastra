import { useContext } from 'react';

import { ChatSessionContext } from './ChatSessionContext';
import type { ChatSessionContextApi } from './ChatSessionContext';

export function useChatSessionContext(): ChatSessionContextApi {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) throw new Error('useChatSessionContext must be used within a ChatSessionProvider');
  return ctx;
}

/**
 * The session context when one is mounted, otherwise null. For status-strip
 * components that render outside a session and only decorate themselves with
 * session-scoped data when it happens to be available.
 */
export function useOptionalChatSessionContext(): ChatSessionContextApi | null {
  return useContext(ChatSessionContext);
}
