import { useContext } from 'react';

import { ChatModesContext } from './ChatModesContext';
import type { ChatModesApi } from './ChatModesContext';

export function useChatModes(): ChatModesApi {
  const ctx = useContext(ChatModesContext);
  if (!ctx) throw new Error('useChatModes must be used within a ChatSessionProvider');
  return ctx;
}
