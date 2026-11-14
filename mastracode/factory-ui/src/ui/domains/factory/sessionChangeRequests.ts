import type { PullRequestStatus } from './boardItems';
import { changeRequestNumberForItem, pullRequestStatusForItem } from './boardItems';
import type { ChangeRequestProvider, PullRequestSubscription } from './services/githubSubscriptions';
import type { WorkItem } from './services/workItems';
import { cardPullRequestLinks, isPullRequestSource } from './services/workItems';

/** A pull or merge request a session links to, from its card or from the thread's subscriptions. */
export interface SessionChangeRequest {
  url: string;
  provider: ChangeRequestProvider;
  number?: number;
  status: PullRequestStatus;
}

/** "PR #5" on GitHub, "MR !7" on GitLab. */
export function changeRequestReference(request: Pick<SessionChangeRequest, 'provider' | 'number'>): string {
  const kind = request.provider === 'gitlab' ? 'MR' : 'PR';
  if (request.number === undefined) return kind;
  return `${kind} ${request.provider === 'gitlab' ? '!' : '#'}${request.number}`;
}

/** Host and path, lowercased: repository slugs are case-insensitive, and the card and subscriptions can disagree on case. */
function changeRequestKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** A pull request card's own pull request. GitLab hosts vary, so only the card's URL names a merge request. */
export function ownChangeRequest(item: WorkItem, repositorySlug: string | undefined): SessionChangeRequest | undefined {
  if (!isPullRequestSource(item.source)) return undefined;
  const provider = item.source === 'gitlab-pr' ? 'gitlab' : 'github';
  const number = changeRequestNumberForItem(item);
  const url =
    item.url ??
    (provider === 'github' && repositorySlug && number !== undefined
      ? `https://github.com/${repositorySlug}/pull/${number}`
      : undefined);
  if (!url) return undefined;
  return { url, provider, ...(number === undefined ? {} : { number }), status: pullRequestStatusForItem(item) };
}

/**
 * Every pull or merge request the session links to, each once: the card's own, those attached to
 * the card, then the ones the thread subscribes to. URLs shown elsewhere, such as a related card
 * that reviews a pull request, are left out.
 */
export function sessionChangeRequests({
  item,
  repositorySlug,
  subscriptions,
  provider,
  shownElsewhere = [],
}: {
  item?: WorkItem;
  repositorySlug?: string;
  subscriptions: readonly PullRequestSubscription[];
  provider: ChangeRequestProvider;
  shownElsewhere?: readonly (string | null | undefined)[];
}): SessionChangeRequest[] {
  const own = item ? ownChangeRequest(item, repositorySlug) : undefined;
  const candidates: SessionChangeRequest[] = [
    ...(own ? [own] : []),
    ...(item ? cardPullRequestLinks(item) : []).map(link => ({
      url: link.url,
      provider: link.provider,
      ...(link.number === undefined ? {} : { number: link.number }),
      status: link.state,
    })),
    ...subscriptions.map(subscription => ({
      url: subscription.url,
      provider,
      number: subscription.pullRequestNumber,
      status: subscription.status,
    })),
  ];
  const seen = new Set(shownElsewhere.flatMap(url => (url ? [changeRequestKey(url)] : [])));
  return candidates.filter(candidate => {
    const key = changeRequestKey(candidate.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
