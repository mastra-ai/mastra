import { useParams } from 'react-router';

// User sessions route as user/threads/:threadId, where the thread segment is the session id.
export function useRouteSessionId(): string | undefined {
  const { sessionId, threadId } = useParams<{ sessionId: string; threadId: string }>();
  return sessionId ?? threadId;
}
