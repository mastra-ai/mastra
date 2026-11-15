import { queryOptions, useQueries } from '@tanstack/react-query';

import type {
  ChangeRequestProvider,
  PullRequestSubscription,
} from '../ui/domains/factory/services/githubSubscriptions';
import { pullRequestSubscriptionsQuery } from '../ui/domains/factory/services/githubSubscriptions';

const SESSION_PULL_REQUEST_SUBSCRIPTIONS_POLL_MS = 5_000;

export interface SessionPullRequestTarget {
  sessionId: string;
  threadId: string;
  provider: ChangeRequestProvider;
}

export function useSessionPullRequestSubscriptions({
  baseUrl,
  targets,
  enabled,
}: {
  baseUrl: string;
  targets: readonly SessionPullRequestTarget[];
  enabled: boolean;
}): Record<string, readonly PullRequestSubscription[] | undefined> {
  const queries = useQueries({
    queries: targets.map(target =>
      queryOptions({
        ...pullRequestSubscriptionsQuery(baseUrl, target.sessionId, target.threadId, target.provider, enabled),
        refetchOnWindowFocus: true,
        refetchInterval: query =>
          query.state.data?.some(subscription => subscription.status === 'open')
            ? SESSION_PULL_REQUEST_SUBSCRIPTIONS_POLL_MS
            : false,
      }),
    ),
  });

  return Object.fromEntries(
    targets.map((target, index) => [target.sessionId, enabled ? queries[index]?.data : undefined]),
  );
}
