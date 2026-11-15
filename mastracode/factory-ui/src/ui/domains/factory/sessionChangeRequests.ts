import type { PullRequestStatus } from './boardItems';
import type { CardChangeRequest } from './changeRequestState';
import { cardChangeRequest, cardChangeRequests, changeRequestKey, changeRequestStatus } from './changeRequestState';
import type { ChangeRequestProvider, PullRequestSubscription } from './services/githubSubscriptions';
import { referenceLabel } from './services/relationships';
import type { WorkItem } from './services/workItems';
import { isPullRequestSource } from './services/workItems';

/** A pull or merge request a session links to, from its card or from the thread's subscriptions. */
export interface SessionChangeRequest {
  url: string;
  provider: ChangeRequestProvider;
  number?: number;
  status: PullRequestStatus | undefined;
}

/** "#5" on GitHub, "!7" on GitLab: the number as its code host writes it. */
export function changeRequestNumberLabel(request: Pick<SessionChangeRequest, 'provider' | 'number'>) {
  if (request.number === undefined) return undefined;
  return `${request.provider === 'gitlab' ? '!' : '#'}${request.number}`;
}

export function changeRequestReference(
  request: Pick<SessionChangeRequest, 'provider' | 'number'> & { url?: string },
  contextRepository?: string,
): string {
  const kind = request.provider === 'gitlab' ? 'MR' : 'PR';
  if (request.number === undefined) return kind;
  return referenceLabel(
    {
      kind,
      sigil: request.provider === 'gitlab' ? '!' : '#',
      number: request.number,
      repository: request.url === undefined ? undefined : changeRequestRepository(request.url),
    },
    contextRepository,
  );
}

export function changeRequestLinkLabel(reference: string, status: PullRequestStatus | undefined): string {
  return status === undefined || status === 'open' ? `Open ${reference}` : `Open ${reference} ${status}`;
}

/** The repository a request's URL names: `owner/repo` on GitHub, the project path on GitLab. */
export function changeRequestRepository(url: string): string | undefined {
  try {
    const path = new URL(url).pathname;
    const end = path.search(/\/(?:pull|-\/merge_requests)\//);
    return end > 0 ? path.slice(1, end) : undefined;
  } catch {
    return undefined;
  }
}

function sessionRequest(
  request: CardChangeRequest & { url: string },
  subscriptions: readonly PullRequestSubscription[],
): SessionChangeRequest {
  return {
    url: request.url,
    provider: request.provider,
    ...(request.number === undefined ? {} : { number: request.number }),
    status: changeRequestStatus(request, subscriptions),
  };
}

/** A pull request card's own pull request. GitLab hosts vary, so only the card's URL names a merge request. */
export function ownChangeRequest(
  item: WorkItem,
  repositorySlug: string | undefined,
  subscriptions: readonly PullRequestSubscription[] = [],
): SessionChangeRequest | undefined {
  const request = isPullRequestSource(item.source) ? cardChangeRequest(item) : undefined;
  if (!request) return undefined;
  const url =
    request.url ??
    (request.provider === 'github' && repositorySlug && request.number !== undefined
      ? `https://github.com/${repositorySlug}/pull/${request.number}`
      : undefined);
  return url === undefined ? undefined : sessionRequest({ ...request, url }, subscriptions);
}

function linked(request: CardChangeRequest): request is CardChangeRequest & { url: string } {
  return request.url !== undefined;
}

export function sessionChangeRequests({
  item,
  subscriptions,
  provider,
  shownElsewhere = [],
}: {
  item?: WorkItem;
  subscriptions: readonly PullRequestSubscription[];
  provider: ChangeRequestProvider;
  shownElsewhere?: readonly (string | undefined)[];
}): SessionChangeRequest[] {
  const carried = (item ? cardChangeRequests(item) : [])
    .filter(linked)
    .map(request => sessionRequest(request, subscriptions))
    .toReversed()
    .toSorted(
      (a, b) =>
        Number(b.status === 'open' || b.status === 'draft') - Number(a.status === 'open' || a.status === 'draft'),
    );
  const candidates: SessionChangeRequest[] = [
    ...carried,
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
