import { useParams } from 'react-router';

import { useThreadSubscriptions } from '../../chat/hooks/useThreadSubscriptions';
import { useSessionRepository } from './useSessionRepository';

export function useSessionSubscriptions() {
  const { threadId } = useParams<{ threadId: string }>();
  const session = useSessionRepository();
  const links = useThreadSubscriptions(threadId, session.repository !== undefined, session.provider);
  return { session, links };
}
