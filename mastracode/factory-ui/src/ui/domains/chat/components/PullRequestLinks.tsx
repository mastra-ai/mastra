import { Button } from '@mastra/playground-ui/components/Button';

import { changeRequestNumberForItem } from '../../factory/boardItems';
import { PullRequestStatusIcon } from '../../factory/components/PullRequestStatusIcon';
import type { ChangeRequestProvider, PullRequestSubscription } from '../../factory/services/githubSubscriptions';
import type { WorkItem } from '../../factory/services/workItems';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import { usePullRequestSubscriptions } from '../hooks/usePullRequestSubscriptions';

interface PullRequestLinksProps {
  repository?: Pick<LinkedRepositoryPayload, 'slug' | 'provider'>;
  reviewItem?: WorkItem;
  threadId: string | undefined;
}

/** Provider vocabulary: GitHub numbers pull requests `#n`, GitLab numbers merge requests `!n`. */
const CHANGE_REQUEST_WORDING: Record<ChangeRequestProvider, { noun: string; prefix: string }> = {
  github: { noun: 'pull request', prefix: 'PR #' },
  gitlab: { noun: 'merge request', prefix: 'MR !' },
};

function reviewStatus(reviewItem: WorkItem): PullRequestSubscription['status'] {
  if (reviewItem.metadata.merged === true) return 'merged';
  if (reviewItem.metadata.state === 'closed') return 'closed';
  return 'open';
}

function reviewSubscription(
  reviewItem: WorkItem | undefined,
  repositorySlug: string | undefined,
  provider: ChangeRequestProvider,
): PullRequestSubscription | undefined {
  if (!reviewItem || !repositorySlug) return undefined;

  const number = changeRequestNumberForItem(reviewItem);
  if (number === undefined) return undefined;

  // GitHub URLs are canonical from the slug; a GitLab instance can live on any
  // host, so only the card's own URL names the merge request.
  const url = provider === 'github' ? `https://github.com/${repositorySlug}/pull/${number}` : reviewItem.url;
  if (!url) return undefined;

  return {
    id: `factory-work-item:${reviewItem.id}`,
    repoFullName: repositorySlug,
    pullRequestNumber: number,
    status: reviewStatus(reviewItem),
    url,
  };
}

function pullRequestLinks(
  subscriptions: PullRequestSubscription[],
  activeReview: PullRequestSubscription | undefined,
): PullRequestSubscription[] {
  if (!activeReview) return subscriptions;

  // repository slugs are case-insensitive — factory config and the subscriptions endpoint can disagree on case
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
 * Change requests subscribed to the active repository-backed thread: GitHub
 * pull requests or GitLab merge requests, depending on the linked repository.
 *
 * Must render inside `ChatSessionBoundary` — `usePullRequestSubscriptions`
 * reads the chat session and transcript contexts.
 */
export function PullRequestLinks({ repository, reviewItem, threadId }: PullRequestLinksProps) {
  const provider: ChangeRequestProvider = repository?.provider === 'gitlab' ? 'gitlab' : 'github';
  const subscriptions = usePullRequestSubscriptions(threadId, Boolean(repository), provider);
  const activeReview = reviewSubscription(reviewItem, repository?.slug, provider);
  const links = pullRequestLinks(subscriptions, activeReview);
  if (links.length === 0) return null;
  const wording = CHANGE_REQUEST_WORDING[provider];

  return (
    <div className="ml-auto flex items-center gap-2">
      {links.map(subscription => (
        <Button
          key={subscription.id}
          as="a"
          variant="ghost"
          size="sm"
          href={subscription.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${subscription.status} ${subscription.repoFullName} ${wording.noun} ${subscription.pullRequestNumber}`}
        >
          <PullRequestStatusIcon status={subscription.status} size={13} decorative />
          <span>
            {wording.prefix}
            {subscription.pullRequestNumber}
          </span>
        </Button>
      ))}
    </div>
  );
}
