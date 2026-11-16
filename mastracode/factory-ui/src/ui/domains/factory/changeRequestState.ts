import type { CardChangeRequest, PullRequestStatus } from '@mastra/factory/work-items/change-requests';

import type { ChangeRequestProvider, PullRequestSubscription } from './services/githubSubscriptions';

interface ChangeRequestTerms {
  kind: 'PR' | 'MR';
  sigil: '#' | '!';
  singular: string;
  plural: string;
  source: 'github-pr' | 'gitlab-pr';
}

export const CHANGE_REQUEST_TERMS: Record<ChangeRequestProvider, ChangeRequestTerms> = {
  github: { kind: 'PR', sigil: '#', singular: 'pull request', plural: 'pull requests', source: 'github-pr' },
  gitlab: { kind: 'MR', sigil: '!', singular: 'merge request', plural: 'merge requests', source: 'gitlab-pr' },
};

const STATUS_WORDS: Record<PullRequestStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  merged: 'Merged',
};

export function changeRequestStatusLabel(provider: ChangeRequestProvider, status: PullRequestStatus): string {
  return `${STATUS_WORDS[status]} ${CHANGE_REQUEST_TERMS[provider].singular}`;
}

export function changeRequestsNoun(providers: readonly ChangeRequestProvider[]): string {
  const [first, ...rest] = providers;
  if (first === undefined || rest.some(provider => provider !== first)) return 'pull and merge requests';
  return CHANGE_REQUEST_TERMS[first].plural;
}

export function changeRequestsHeading(providers: readonly ChangeRequestProvider[]): string {
  const noun = changeRequestsNoun(providers);
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
}

export function isOpenChangeRequest(status: PullRequestStatus | undefined): boolean {
  return status === 'open' || status === 'draft';
}

export function changeRequestKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function openStatus(request: CardChangeRequest): PullRequestStatus {
  return request.draft ? 'draft' : 'open';
}

function subscriptionFor(
  request: CardChangeRequest,
  subscriptions: readonly PullRequestSubscription[],
): PullRequestSubscription | undefined {
  // Numbers repeat across repositories, so a request without a URL matches no subscription.
  if (request.url === undefined) return undefined;
  const key = changeRequestKey(request.url);
  return subscriptions.find(subscription => changeRequestKey(subscription.url) === key);
}

export function changeRequestStatus(
  request: CardChangeRequest,
  subscriptions: readonly PullRequestSubscription[] = [],
): PullRequestStatus | undefined {
  const known = request.status;
  const subscription = subscriptionFor(request, subscriptions);
  if (!subscription) return known;
  if (known === 'merged' || subscription.status === 'merged') return 'merged';
  // Subscribing again reopens a subscription without asking the code host, so its "open" never undoes a known close.
  if (known === 'closed' && subscription.status === 'open') return 'closed';
  const sourceHeardLast =
    subscription.updatedAt !== undefined &&
    request.syncedAt !== undefined &&
    !(Date.parse(subscription.updatedAt) > request.syncedAt);
  if (known !== undefined && sourceHeardLast) return known;
  return subscription.status === 'open' ? openStatus(request) : subscription.status;
}
