import { useContext } from 'react';

import { ChatSessionActionsContext } from './ChatSessionActionsContext';

export function useChatSessionActions() {
  const actions = useContext(ChatSessionActionsContext);
  if (!actions) throw new Error('useChatSessionActions must be used within a ChatSessionActionsProvider');
  return actions;
}
