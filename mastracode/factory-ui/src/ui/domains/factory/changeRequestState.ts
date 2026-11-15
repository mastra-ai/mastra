import type { PullRequestStatus } from './boardItems';
import { changeRequestNumberForItem, sourceMetadata } from './boardItems';
import type { ChangeRequestProvider, PullRequestSubscription } from './services/githubSubscriptions';
import type { CardPullRequestSource, WorkItem } from './services/workItems';
import {
  attachedPullRequestSource,
  cardPullRequestSources,
  isPullRequestSource,
  sourcePullRequestNumber,
} from './services/workItems';

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

export function isSettledChangeRequest(status: PullRequestStatus | undefined): boolean {
  return status === 'merged' || status === 'closed';
}

export interface CardChangeRequest {
  url: string | undefined;
  provider: ChangeRequestProvider;
  number: number | undefined;
  state: string | undefined;
  metadata: Record<string, unknown>;
  syncedAt: number | undefined;
}

type ChangeRequestCard = Pick<WorkItem, 'source' | 'workItem' | 'metadata'> & Partial<Pick<WorkItem, 'url'>>;

function fromSource(source: CardPullRequestSource): CardChangeRequest {
  const syncedAt = source.syncedAt ? new Date(source.syncedAt).getTime() : Number.NaN;
  return {
    url: source.url ?? undefined,
    provider: source.provider === 'gitlab' ? 'gitlab' : 'github',
    number: sourcePullRequestNumber(source),
    state: source.state ?? undefined,
    metadata: source.metadata ?? {},
    syncedAt: Number.isNaN(syncedAt) ? undefined : syncedAt,
  };
}

function fromLegacyCard(item: ChangeRequestCard): CardChangeRequest {
  return {
    url: item.url ?? undefined,
    provider: item.source === 'gitlab-pr' ? 'gitlab' : 'github',
    number: changeRequestNumberForItem(item),
    state: item.workItem?.state ?? undefined,
    metadata: sourceMetadata(item),
    syncedAt: undefined,
  };
}

export function cardChangeRequests(item: ChangeRequestCard): CardChangeRequest[] {
  const sources = cardPullRequestSources(item);
  if (sources.length > 0) return sources.map(fromSource);
  return isPullRequestSource(item.source) ? [fromLegacyCard(item)] : [];
}

export function cardChangeRequest(item: ChangeRequestCard): CardChangeRequest | undefined {
  if (isPullRequestSource(item.source)) return cardChangeRequests(item)[0];
  const attached = attachedPullRequestSource(item);
  return attached ? fromSource(attached) : undefined;
}

export function changeRequestKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function sourceStatus(request: CardChangeRequest): PullRequestStatus | undefined {
  const state = request.state ?? request.metadata.state;
  if (state === 'merged' || request.metadata.merged === true) return 'merged';
  if (state === 'closed') return 'closed';
  if (state === 'open' || state === 'opened' || state === 'locked') return openStatus(request);
  return undefined;
}

function openStatus(request: CardChangeRequest): PullRequestStatus {
  return request.metadata.draft === true ? 'draft' : 'open';
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
  const known = sourceStatus(request);
  const subscription = subscriptionFor(request, subscriptions);
  if (!subscription) return known;
  if (known === 'merged' || subscription.status === 'merged') return 'merged';
  // Subscribing again reopens a subscription without asking the code host, so its "open" never undoes a known close.
  if (known === 'closed' && subscription.status === 'open') return 'closed';
  const subscribedAt = subscription.updatedAt === undefined ? Number.NaN : Date.parse(subscription.updatedAt);
  if (known !== undefined && request.syncedAt !== undefined && !(subscribedAt > request.syncedAt)) return known;
  return subscription.status === 'open' ? openStatus(request) : subscription.status;
}
