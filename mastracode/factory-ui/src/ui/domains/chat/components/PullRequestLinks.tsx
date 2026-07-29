import { Button } from '@mastra/playground-ui/components/Button';
import { useQuery } from '@tanstack/react-query';
import { GitMerge, GitPullRequest, GitPullRequestClosed } from 'lucide-react';
import { useEffect, useRef } from 'react';

import type { WorkItem } from '../../factory/services/workItems';
import type { TranscriptState } from '../services/transcript';

interface PullRequestSubscription {
  id: string;
  repoFullName: string;
  pullRequestNumber: number;
  status: 'open' | 'closed' | 'merged';
  url: string;
}

interface PullRequestSubscriptionsResponse {
  subscriptions: PullRequestSubscription[];
}

function PullRequestIcon({ status }: { status: PullRequestSubscription['status'] }) {
  const className = statusIconColor(status);

  if (status === 'merged') return <GitMerge size={13} className={className} aria-hidden />;
  if (status === 'closed') return <GitPullRequestClosed size={13} className={className} aria-hidden />;
  return <GitPullRequest size={13} className={className} aria-hidden />;
}

function statusIconColor(status: PullRequestSubscription['status']): string {
  if (status === 'merged') return 'text-accent3';
  if (status === 'closed') return 'text-error';
  return 'text-accent1';
}

interface PullRequestLinksProps {
  baseUrl: string;
  resourceId: string;
  projectPath: string | undefined;
  projectRepositoryId: unknown;
  reviewItem?: WorkItem;
  repositorySlug: string | undefined;
  threadId: string | undefined;
  transcriptEntries: TranscriptState['entries'];
  busy: boolean;
  size?: 'xs' | 'sm';
}

/** Pull requests subscribed to the active GitHub-backed thread. */
export function PullRequestLinks({
  baseUrl,
  resourceId,
  projectPath,
  projectRepositoryId,
  reviewItem,
  repositorySlug,
  threadId,
  transcriptEntries,
  busy,
  size = 'xs',
}: PullRequestLinksProps) {
  const wasBusy = useRef(busy);
  const reviewNumber = reviewItem?.metadata.githubPullRequestNumber ?? reviewItem?.metadata.number;
  const normalizedReviewNumber = Number(reviewNumber);
  const factorySubscription: PullRequestSubscription | undefined =
    reviewItem &&
    repositorySlug &&
    (typeof reviewNumber === 'number' || typeof reviewNumber === 'string') &&
    Number.isInteger(normalizedReviewNumber)
      ? {
          id: `factory-work-item:${reviewItem.id}`,
          repoFullName: repositorySlug,
          pullRequestNumber: normalizedReviewNumber,
          status:
            reviewItem.metadata.merged === true ? 'merged' : reviewItem.metadata.state === 'closed' ? 'closed' : 'open',
          url: `https://github.com/${repositorySlug}/pull/${normalizedReviewNumber}`,
        }
      : undefined;
  const notificationIds = transcriptEntries
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
  const enabled = typeof projectRepositoryId === 'string' && Boolean(threadId);
  const query = useQuery({
    queryKey: ['github', 'subscriptions', resourceId, threadId, projectPath],
    queryFn: async () => {
      if (!threadId) return { subscriptions: [] };
      const params = new URLSearchParams({ resourceId, threadId });
      if (projectPath) params.set('scope', projectPath);
      const response = await fetch(`${baseUrl}/web/github/subscriptions?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error(`Failed to load pull request subscriptions (${response.status}).`);
      return response.json() as Promise<PullRequestSubscriptionsResponse>;
    },
    enabled,
  });

  useEffect(() => {
    if (notificationIds) void query.refetch();
  }, [notificationIds, query.refetch]);

  useEffect(() => {
    if (wasBusy.current && !busy) void query.refetch();
    wasBusy.current = busy;
  }, [busy, query.refetch]);

  const subscriptions = query.data?.subscriptions ?? [];
  const links =
    factorySubscription &&
    !subscriptions.some(
      subscription =>
        subscription.repoFullName === factorySubscription.repoFullName &&
        subscription.pullRequestNumber === factorySubscription.pullRequestNumber,
    )
      ? [...subscriptions, factorySubscription]
      : subscriptions;
  if (links.length === 0) return null;

  return (
    <div className="ml-auto flex items-center gap-2">
      {links.map(subscription => (
        <Button
          key={subscription.id}
          as="a"
          variant="ghost"
          size={size}
          href={subscription.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${subscription.status} ${subscription.repoFullName} pull request ${subscription.pullRequestNumber}`}
        >
          <PullRequestIcon status={subscription.status} />
          <span>PR #{subscription.pullRequestNumber}</span>
        </Button>
      ))}
    </div>
  );
}
