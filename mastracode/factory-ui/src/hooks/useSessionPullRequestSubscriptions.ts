import { queryOptions, skipToken, useQueries } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import type {
  ChangeRequestProvider,
  PullRequestSubscription,
} from '../ui/domains/factory/services/githubSubscriptions';
import { listPullRequestSubscriptions } from '../ui/domains/factory/services/githubSubscriptions';

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
        queryKey: queryKeys.sidebarPullRequestSubscriptions(target.provider, target.sessionId, target.threadId),
        queryFn: enabled
          ? () => listPullRequestSubscriptions(baseUrl, target.sessionId, target.threadId, target.provider)
          : skipToken,
        // The feed provider refreshes this. A hidden tab holds no stream, so refresh on return.
        refetchOnWindowFocus: true,
      }),
    ),
  });

  return Object.fromEntries(
    targets.map((target, index) => [target.sessionId, enabled ? queries[index]?.data : undefined]),
  );
}
