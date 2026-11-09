import { useContext } from 'react';

import { ChatThinkingContext } from './ChatThinkingContext';
import type { ChatThinkingApi } from './ChatThinkingContext';

export function useChatThinking(): ChatThinkingApi {
  const ctx = useContext(ChatThinkingContext);
  if (!ctx) throw new Error('useChatThinking must be used within a ChatSessionProvider');
  return ctx;
}
