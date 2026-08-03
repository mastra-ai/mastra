import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { PullRequestSubscription } from '../../factory/services/githubSubscriptions';
import {
  listPullRequestSubscriptions,
  pullRequestSubscriptionsQueryKey,
} from '../../factory/services/githubSubscriptions';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import type { TranscriptState } from '../services/transcript';

const NO_SUBSCRIPTIONS: PullRequestSubscription[] = [];

function notificationKey(entries: TranscriptState['entries']): string {
  return entries
    .flatMap(entry => {
      if (entry.kind === 'notification') return [entry.notificationId];
      if (entry.kind !== 'message') return [];
      const content = entry.message.content.metadata?.harnessContent;
      if (!Array.isArray(content)) return [];
      return content.flatMap(part =>
        typeof part === 'object' && part !== null && 'type' in part && part.type === 'notification'
          ? ['notificationId' in part ? part.notificationId : undefined]
          : [],
      );
    })
    .filter(id => typeof id === 'string')
    .join(':');
}

export function usePullRequestSubscriptions(threadId: string | undefined, enabled: boolean) {
  const { baseUrl, resourceId, projectPath } = useChatSessionContext();
  const { transcript, busy } = useChatTranscript();
  const queryClient = useQueryClient();
  const notificationIds = notificationKey(transcript.entries);
  const sessionKey = `${resourceId}:${threadId}:${projectPath}`;
  const previous = useRef({ busy, notificationIds, sessionKey });
  const active = enabled && Boolean(threadId);

  const query = useQuery({
    queryKey: pullRequestSubscriptionsQueryKey(resourceId, threadId, projectPath),
    queryFn:
      active && threadId ? () => listPullRequestSubscriptions(baseUrl, resourceId, threadId, projectPath) : skipToken,
  });

  useEffect(() => {
    const seen = previous.current;
    previous.current = { busy, notificationIds, sessionKey };

    // another session's values, nothing to compare against — the new key fetches on its own
    if (seen.sessionKey !== sessionKey) return;

    const runSettled = seen.busy && !busy;
    const newNotification = seen.notificationIds !== notificationIds;
    if (!runSettled && !newNotification) return;
    if (!active) return;
    void queryClient.invalidateQueries({
      queryKey: pullRequestSubscriptionsQueryKey(resourceId, threadId, projectPath),
    });
  }, [active, busy, notificationIds, projectPath, queryClient, resourceId, sessionKey, threadId]);

  return query.data ?? NO_SUBSCRIPTIONS;
}
