import { useParams } from 'react-router';

import { useChatConnection } from '../context/useChatConnection';

/**
 * The URL is the requested conversation; connection state is the thread the
 * server is currently bound to. A mismatch is a transition, not ready state.
 */
export function useIsRouteThreadSwitching(): boolean {
  const { threadId: routeThreadId } = useParams<{ threadId: string }>();
  const { threadId: activeThreadId } = useChatConnection();

  return Boolean(routeThreadId && routeThreadId !== activeThreadId);
}
