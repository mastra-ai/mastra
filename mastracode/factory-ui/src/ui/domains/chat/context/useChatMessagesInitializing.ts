import { useContext } from 'react';

import { ChatThreadMessagesContext } from './ChatThreadMessagesContext';

/**
 * True while the initial thread-messages fetch is in flight. False outside a
 * `ChatSessionBoundary` (e.g. draft composer routes with no thread), so "no
 * boundary" never reads as "still loading".
 */
export function useChatMessagesInitializing(): boolean {
  return useContext(ChatThreadMessagesContext)?.isPending ?? false;
}
