import { useContext } from 'react';

import { ChatConnectionContext } from './ChatConnectionContext';
import type { ChatConnectionApi } from './ChatConnectionContext';

export function useChatConnection(): ChatConnectionApi {
  const ctx = useContext(ChatConnectionContext);
  if (!ctx) throw new Error('useChatConnection must be used within a ChatSessionProvider');
  return ctx;
}
