import { useContext } from 'react';

import { ChatSessionContext } from './ChatSessionContext';
import type { ChatSessionContextApi } from './ChatSessionContext';

export function useChatSessionContext(): ChatSessionContextApi {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) throw new Error('useChatSessionContext must be used within a ChatSessionProvider');
  return ctx;
}
