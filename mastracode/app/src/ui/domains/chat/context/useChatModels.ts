import { useContext } from 'react';

import { ChatModelsContext } from './ChatModelsContext';
import type { ChatModelsApi } from './ChatModelsContext';

export function useChatModels(): ChatModelsApi {
  const ctx = useContext(ChatModelsContext);
  if (!ctx) throw new Error('useChatModels must be used within a ChatSessionProvider');
  return ctx;
}
