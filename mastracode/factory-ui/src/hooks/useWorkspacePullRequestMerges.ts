import { queryOptions, useQueries } from '@tanstack/react-query';

import {
  listPullRequestSubscriptions,
  pullRequestSubscriptionsQueryKey,
} from '../ui/domains/factory/services/githubSubscriptions';

export const WORKSPACE_PR_STATUS_POLL_MS = 5_000;

export interface WorkspacePullRequestTarget {
  sessionId: string;
  threadId: string;
  projectPath: string;
  pullRequestNumber: number;
  knownMerged: boolean;
}

export function useWorkspacePullRequestMerges({
  baseUrl,
  resourceId,
  targets,
  enabled,
}: {
  baseUrl: string;
  resourceId: string;
  targets: WorkspacePullRequestTarget[];
  enabled: boolean;
}): Record<string, boolean> {
  const queries = useQueries({
    queries: targets.map(target =>
      queryOptions({
        queryKey: [
          ...pullRequestSubscriptionsQueryKey(resourceId, target.threadId, target.projectPath),
          target.pullRequestNumber,
        ],
        queryFn: () => listPullRequestSubscriptions(baseUrl, resourceId, target.threadId, target.projectPath),
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

  const mergedBySessionId: Record<string, boolean> = {};
  targets.forEach((target, index) => {
    if (!enabled) {
      mergedBySessionId[target.sessionId] = target.knownMerged;
      return;
    }

    const query = queries[index];
    if (!query?.isSuccess) {
      mergedBySessionId[target.sessionId] = target.knownMerged;
      return;
    }

    const subscription = query.data.find(candidate => candidate.pullRequestNumber === target.pullRequestNumber);
    mergedBySessionId[target.sessionId] = subscription ? subscription.status === 'merged' : target.knownMerged;
  });

  return mergedBySessionId;
}
