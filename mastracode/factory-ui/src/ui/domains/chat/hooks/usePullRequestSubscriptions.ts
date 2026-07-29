import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { TranscriptState } from '../services/transcript';
import { fetchPullRequestSubscriptions } from '../services/pullRequestSubscriptions';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';

function pullRequestSubscriptionsQueryKey(
  resourceId: string,
  threadId: string | undefined,
  projectPath: string | undefined,
) {
  return ['github', 'subscriptions', resourceId, threadId, projectPath] as const;
}

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

export function usePullRequestSubscriptions(projectRepositoryId: string | undefined, threadId: string | undefined) {
  const { baseUrl, resourceId, projectPath } = useChatSessionContext();
  const { transcript, busy } = useChatTranscript();
  const queryClient = useQueryClient();
  const wasBusy = useRef(busy);
  const notificationIds = notificationKey(transcript.entries);

  const query = useQuery({
    queryKey: pullRequestSubscriptionsQueryKey(resourceId, threadId, projectPath),
    queryFn:
      projectRepositoryId && threadId
        ? () => fetchPullRequestSubscriptions(baseUrl, resourceId, threadId, projectPath)
        : skipToken,
  });

  useEffect(() => {
    if (!projectRepositoryId || !threadId || !notificationIds) return;
    void queryClient.invalidateQueries({
      queryKey: pullRequestSubscriptionsQueryKey(resourceId, threadId, projectPath),
    });
  }, [notificationIds, projectPath, projectRepositoryId, queryClient, resourceId, threadId]);

  useEffect(() => {
    if (wasBusy.current && !busy && projectRepositoryId && threadId) {
      void queryClient.invalidateQueries({
        queryKey: pullRequestSubscriptionsQueryKey(resourceId, threadId, projectPath),
      });
    }
    wasBusy.current = busy;
  }, [busy, projectPath, projectRepositoryId, queryClient, resourceId, threadId]);

  return query.data ?? [];
}
