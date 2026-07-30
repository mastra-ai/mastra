import { Button } from '@mastra/playground-ui/components/Button';
import { GitMerge, GitPullRequest, GitPullRequestClosed } from 'lucide-react';

import type { WorkItem } from '../../factory/services/workItems';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import { usePullRequestSubscriptions } from '../hooks/usePullRequestSubscriptions';
import type { PullRequestSubscription } from '../services/pullRequestSubscriptions';

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
  repository?: Pick<LinkedRepositoryPayload, 'projectRepositoryId' | 'slug'>;
  reviewItem?: WorkItem;
  threadId: string | undefined;
  size?: 'xs' | 'sm';
}

function reviewStatus(reviewItem: WorkItem): PullRequestSubscription['status'] {
  if (reviewItem.metadata.merged === true) return 'merged';
  if (reviewItem.metadata.state === 'closed') return 'closed';
  return 'open';
}

function reviewSubscription(
  reviewItem: WorkItem | undefined,
  repositorySlug: string | undefined,
): PullRequestSubscription | undefined {
  if (!reviewItem || !repositorySlug) return undefined;

  const reviewNumber = reviewItem.metadata.githubPullRequestNumber ?? reviewItem.metadata.number;
  if (typeof reviewNumber !== 'number' && typeof reviewNumber !== 'string') return undefined;

  const normalizedReviewNumber = Number(reviewNumber);
  if (!Number.isInteger(normalizedReviewNumber)) return undefined;

  return {
    id: `factory-work-item:${reviewItem.id}`,
    repoFullName: repositorySlug,
    pullRequestNumber: normalizedReviewNumber,
    status: reviewStatus(reviewItem),
    url: `https://github.com/${repositorySlug}/pull/${normalizedReviewNumber}`,
  };
}

function pullRequestLinks(
  subscriptions: PullRequestSubscription[],
  activeReview: PullRequestSubscription | undefined,
): PullRequestSubscription[] {
  if (!activeReview) return subscriptions;

  const alreadySubscribed = subscriptions.some(
    subscription =>
      subscription.repoFullName === activeReview.repoFullName &&
      subscription.pullRequestNumber === activeReview.pullRequestNumber,
  );
  if (alreadySubscribed) return subscriptions;
  return [...subscriptions, activeReview];
}

/** Pull requests subscribed to the active GitHub-backed thread. */
export function PullRequestLinks({ repository, reviewItem, threadId, size = 'xs' }: PullRequestLinksProps) {
  const subscriptions = usePullRequestSubscriptions(repository?.projectRepositoryId, threadId);
  const activeReview = reviewSubscription(reviewItem, repository?.slug);
  const links = pullRequestLinks(subscriptions, activeReview);
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
