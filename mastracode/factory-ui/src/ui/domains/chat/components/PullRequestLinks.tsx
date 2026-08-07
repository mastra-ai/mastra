import { Button } from '@mastra/playground-ui/components/Button';

import { PullRequestStatusIcon } from '../../factory/components/PullRequestStatusIcon';
import type { PullRequestSubscription } from '../../factory/services/githubSubscriptions';
import type { WorkItem } from '../../factory/services/workItems';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import { usePullRequestSubscriptions } from '../hooks/usePullRequestSubscriptions';

interface PullRequestLinksProps {
  repository?: Pick<LinkedRepositoryPayload, 'slug'>;
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
  if (!Number.isInteger(normalizedReviewNumber) || normalizedReviewNumber <= 0) return undefined;

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

  // github slugs are case-insensitive — factory config and the subscriptions endpoint can disagree on case
  const activeRepo = activeReview.repoFullName.toLowerCase();
  const alreadySubscribed = subscriptions.some(
    subscription =>
      subscription.repoFullName.toLowerCase() === activeRepo &&
      subscription.pullRequestNumber === activeReview.pullRequestNumber,
  );
  if (alreadySubscribed) return subscriptions;
  return [...subscriptions, activeReview];
}

/**
 * Pull requests subscribed to the active GitHub-backed thread.
 *
 * Must render inside `ChatSessionBoundary` — `usePullRequestSubscriptions`
 * reads the chat session and transcript contexts.
 */
export function PullRequestLinks({ repository, reviewItem, threadId, size = 'xs' }: PullRequestLinksProps) {
  const subscriptions = usePullRequestSubscriptions(threadId, Boolean(repository));
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
          <PullRequestStatusIcon status={subscription.status} size={13} decorative />
          <span>PR #{subscription.pullRequestNumber}</span>
        </Button>
      ))}
    </div>
  );
}
