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

export const CHANGE_REQUEST_STATUS_LABELS: Record<ChangeRequestProvider, Record<PullRequestStatus, string>> = {
  github: {
    draft: 'Draft pull request',
    open: 'Open pull request',
    closed: 'Closed pull request',
    merged: 'Merged pull request',
  },
  gitlab: {
    draft: 'Draft merge request',
    open: 'Open merge request',
    closed: 'Closed merge request',
    merged: 'Merged merge request',
  },
};

export function changeRequestSource(provider: ChangeRequestProvider): 'github-pr' | 'gitlab-pr' {
  return provider === 'gitlab' ? 'gitlab-pr' : 'github-pr';
}

export interface CardChangeRequest {
  url: string | undefined;
  provider: ChangeRequestProvider;
  number: number | undefined;
  state: string | undefined;
  metadata: Record<string, unknown>;
  /** Epoch milliseconds. */
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

/** Mirrors the server's `reviewedPullRequest` pick. */
export function cardChangeRequest(item: ChangeRequestCard): CardChangeRequest | undefined {
  if (isPullRequestSource(item.source)) return cardChangeRequests(item)[0];
  const attached = attachedPullRequestSource(item);
  return attached ? fromSource(attached) : undefined;
}

/** Slugs are case-insensitive, and the card and subscriptions can disagree on case. */
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
  if (request.url === undefined) {
    return subscriptions.find(subscription => subscription.pullRequestNumber === request.number);
  }
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
