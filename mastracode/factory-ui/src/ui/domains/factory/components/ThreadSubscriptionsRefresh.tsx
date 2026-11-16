import { useParams } from 'react-router';

import { useRefreshThreadSubscriptions } from '../../chat/hooks/useRefreshThreadSubscriptions';
import { useSessionRepository } from '../hooks/useSessionRepository';

// Its own component so each transcript update re-renders only this, not the session page.
export function ThreadSubscriptionsRefresh() {
  const { threadId } = useParams<{ threadId: string }>();
  const { repository, provider } = useSessionRepository();
  useRefreshThreadSubscriptions(threadId, repository !== undefined, provider);
  return null;
}
