import { cardChangeRequest, cardChangeRequests } from '@mastra/factory/work-items/change-requests';
import type { CardChangeRequest, PullRequestStatus } from '@mastra/factory/work-items/change-requests';

import { CHANGE_REQUEST_TERMS, changeRequestKey, changeRequestStatus, isOpenChangeRequest } from './changeRequestState';
import type { ChangeRequestProvider, PullRequestSubscription } from './services/githubSubscriptions';
import { referenceLabel } from './services/relationships';
import type { WorkItem } from './services/workItems';
import { isPullRequestSource } from './services/workItems';

export interface SessionChangeRequest {
  url: string;
  provider: ChangeRequestProvider;
  number?: number;
  status: PullRequestStatus | undefined;
}

export function changeRequestNumberLabel(request: Pick<SessionChangeRequest, 'provider' | 'number'>) {
  if (request.number === undefined) return undefined;
  return `${CHANGE_REQUEST_TERMS[request.provider].sigil}${request.number}`;
}

export function changeRequestReference(
  request: Pick<SessionChangeRequest, 'provider' | 'number'> & { url?: string },
  contextRepository?: string,
): string {
  const { kind, sigil } = CHANGE_REQUEST_TERMS[request.provider];
  if (request.number === undefined) return kind;
  return referenceLabel(
    {
      kind,
      sigil,
      number: request.number,
      repository: request.url === undefined ? undefined : changeRequestRepository(request.url),
    },
    contextRepository,
  );
}

export function changeRequestLinkLabel(reference: string, status: PullRequestStatus | undefined): string {
  return status === undefined || status === 'open' ? `Open ${reference}` : `Open ${reference} ${status}`;
}

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
    .toSorted((a, b) => Number(isOpenChangeRequest(b.status)) - Number(isOpenChangeRequest(a.status)));
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
