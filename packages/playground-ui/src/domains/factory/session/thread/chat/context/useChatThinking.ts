import { useContext } from 'react';

import { ChatThinkingContext } from './ChatThinkingContext';
import type { ChatThinkingApi } from './ChatThinkingContext';

export function useChatThinking(): ChatThinkingApi {
  const ctx = useContext(ChatThinkingContext);
  if (!ctx) throw new Error('useChatThinking must be used within a ChatSessionProvider');
  return ctx;
}

/** The thinking capability, or `undefined` when the host doesn't provide one. */
export function useOptionalChatThinking(): ChatThinkingApi | undefined {
  return useContext(ChatThinkingContext) ?? undefined;
}
