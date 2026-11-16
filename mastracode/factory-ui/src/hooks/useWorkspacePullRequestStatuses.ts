import { queryOptions, useQueries } from '@tanstack/react-query';

import {
  listPullRequestSubscriptions,
  pullRequestSubscriptionsQueryKey,
} from '../ui/domains/factory/services/githubSubscriptions';
import type {
  ChangeRequestProvider,
  PullRequestSubscription,
} from '../ui/domains/factory/services/githubSubscriptions';

export type LivePullRequestStatus = PullRequestSubscription['status'];

export const WORKSPACE_PR_STATUS_POLL_MS = 5_000;

export interface WorkspacePullRequestTarget {
  sessionId: string;
  threadId: string;
  pullRequestNumber: number;
  /** Route to poll; defaults to GitHub for callers that predate GitLab review cards. */
  provider?: ChangeRequestProvider;
  knownMerged: boolean;
}

export function useWorkspacePullRequestStatuses({
  baseUrl,
  targets,
  enabled,
}: {
  baseUrl: string;
  targets: WorkspacePullRequestTarget[];
  enabled: boolean;
}): Record<string, LivePullRequestStatus | undefined> {
  const queries = useQueries({
    queries: targets.map(target =>
      queryOptions({
        queryKey: [
          ...pullRequestSubscriptionsQueryKey(target.sessionId, target.threadId, target.provider),
          target.pullRequestNumber,
        ],
        queryFn: () => listPullRequestSubscriptions(baseUrl, target.sessionId, target.threadId, target.provider),
        enabled,
        refetchOnWindowFocus: true,
        refetchInterval: query => {
          if (query.state.status !== 'success') return false;
          const subscription = query.state.data?.find(
            candidate => candidate.pullRequestNumber === target.pullRequestNumber,
          );
          return subscription?.status === 'open' ? WORKSPACE_PR_STATUS_POLL_MS : false;
        },
      }),
    ),
  });

  // The subscription's state when the check has it, otherwise only what the item already knows.
  const statusBySessionId: Record<string, LivePullRequestStatus | undefined> = {};
  targets.forEach((target, index) => {
    const query = enabled ? queries[index] : undefined;
    const subscription = query?.isSuccess
      ? query.data.find(candidate => candidate.pullRequestNumber === target.pullRequestNumber)
      : undefined;
    statusBySessionId[target.sessionId] = subscription?.status ?? (target.knownMerged ? 'merged' : undefined);
  });

  return statusBySessionId;
}
