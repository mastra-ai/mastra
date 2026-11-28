import { useContext } from 'react';

import { ChatThreadMessagesContext } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/ChatThreadMessagesContext';

/** False outside a `ChatSessionBoundary` (draft routes have no thread), so "no boundary" never reads as "still loading". */
export function useChatMessagesInitializing(): boolean {
  return useContext(ChatThreadMessagesContext)?.isPending ?? false;
}
