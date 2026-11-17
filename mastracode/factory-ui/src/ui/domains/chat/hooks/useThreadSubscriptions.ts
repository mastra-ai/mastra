import { useQuery } from '@tanstack/react-query';

import type { ChangeRequestProvider, PullRequestSubscription } from '../../factory/services/githubSubscriptions';
import { pullRequestSubscriptionsQuery } from '../../factory/services/githubSubscriptions';
import { useChatSessionContext } from '../context/useChatSessionContext';

const NO_SUBSCRIPTIONS: PullRequestSubscription[] = [];

export function useThreadSubscriptions(
  threadId: string | undefined,
  enabled: boolean,
  provider: ChangeRequestProvider = 'github',
) {
  const { baseUrl, sessionId } = useChatSessionContext();
  const active = enabled && Boolean(threadId);
  const query = useQuery(pullRequestSubscriptionsQuery(baseUrl, sessionId, threadId, provider, active));
  return {
    subscriptions: query.data ?? NO_SUBSCRIPTIONS,
    pending: active && query.isPending,
    failed: active && query.isLoadingError,
  };
}
