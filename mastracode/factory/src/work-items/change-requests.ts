import type { WorkItemSourceRow } from '../storage/domains/work-items/work-item-schema.js';

export interface SourcedItem {
  readonly workItem?: { readonly sources?: readonly WorkItemSourceRow[] } | null;
}

/**
 * A card whose own primary source is a pull or merge request: an outside contributor's
 * PR filed on its own card, or a PR card filed before PRs attached to their issue's card.
 * An issue card with an attached PR is not one; see `hasPullRequest`.
 */
export function isPullRequestCard(item: { readonly source: string }): boolean {
  return item.source === 'github-pr' || item.source === 'gitlab-pr';
}

/** Every pull or merge request source on a card, oldest first. */
export function pullRequestSources(item: SourcedItem): WorkItemSourceRow[] {
  return (item.workItem?.sources ?? []).filter(source => source.sourceType === 'pull-request');
}

/** The provider number (GitHub PR number, GitLab MR IID) a pull request source names. */
export function pullRequestSourceNumber(source: Pick<WorkItemSourceRow, 'metadata'>): number | undefined {
  const metadata = source.metadata ?? {};
  const value = metadata.githubPullRequestNumber ?? metadata.gitlabMergeRequestIid ?? metadata.number;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

export function isOpenPullRequestSource(source: Pick<WorkItemSourceRow, 'state' | 'metadata'>): boolean {
  return !isSettledChangeRequest(reportedStatus(source.state, source.metadata ?? {}));
}

/**
 * The pull request a PR review pass on this card reviews: the one the card's
 * `openPullRequestNumber` names, else the newest open one, else the newest one.
 */
export function reviewedPullRequest(
  item: SourcedItem & { readonly metadata?: Record<string, unknown> | null },
): WorkItemSourceRow | undefined {
  const sources = pullRequestSources(item);
  const pointer = item.metadata?.openPullRequestNumber;
  return (
    (typeof pointer === 'number' ? sources.find(source => pullRequestSourceNumber(source) === pointer) : undefined) ??
    sources.findLast(isOpenPullRequestSource) ??
    sources.at(-1)
  );
}

export const PULL_REQUEST_STATUSES = ['draft', 'open', 'closed', 'merged'] as const;
export type PullRequestStatus = (typeof PULL_REQUEST_STATUSES)[number];

export interface CardChangeRequest {
  url?: string;
  provider: 'github' | 'gitlab';
  number?: number;
  /** Undefined while the code host has reported no state. */
  status?: PullRequestStatus;
  draft: boolean;
  /** Epoch milliseconds of the code host's last report. */
  syncedAt?: number;
}

interface ChangeRequestCard {
  readonly source: string;
  readonly url?: string | null;
  readonly metadata?: Record<string, unknown> | null;
  readonly workItem?: {
    readonly provider?: string;
    readonly state?: string | null;
    readonly metadata?: Record<string, unknown> | null;
    readonly sources?: readonly WorkItemSourceRow[];
  } | null;
}

export function isSettledChangeRequest(status: PullRequestStatus | undefined): boolean {
  return status === 'merged' || status === 'closed';
}

function reportedStatus(state: unknown, metadata: Record<string, unknown>): PullRequestStatus | undefined {
  const reported = state ?? metadata.state;
  if (reported === 'merged' || metadata.merged === true) return 'merged';
  if (reported === 'closed') return 'closed';
  if (reported === 'open' || reported === 'opened' || reported === 'locked') {
    return metadata.draft === true ? 'draft' : 'open';
  }
  return undefined;
}

function fromSource(source: WorkItemSourceRow): CardChangeRequest {
  const metadata = source.metadata ?? {};
  const syncedAt = source.syncedAt ? new Date(source.syncedAt).getTime() : Number.NaN;
  return {
    url: source.url ?? undefined,
    provider: source.provider === 'gitlab' ? 'gitlab' : 'github',
    number: pullRequestSourceNumber(source),
    status: reportedStatus(source.state, metadata),
    draft: metadata.draft === true,
    syncedAt: Number.isNaN(syncedAt) ? undefined : syncedAt,
  };
}

export function changeRequestNumber(source: string, metadata: Record<string, unknown>): number | undefined {
  if (source === 'github-pr') {
    const number = metadata.githubPullRequestNumber ?? metadata.number;
    return typeof number === 'number' && Number.isInteger(number) && number > 0 ? number : undefined;
  }
  if (source !== 'gitlab-pr') return undefined;
  const iid = metadata.gitlabMergeRequestIid;
  return typeof iid === 'number' && Number.isSafeInteger(iid) && iid > 0 ? iid : undefined;
}

/** A pull request card filed before its sources were recorded: the card's own source is the request. */
function fromLegacyCard(card: ChangeRequestCard): CardChangeRequest {
  const sourced = card.workItem && card.workItem.provider !== 'factory';
  const metadata = (sourced ? card.workItem?.metadata : card.metadata) ?? {};
  return {
    url: card.url ?? undefined,
    provider: card.source === 'gitlab-pr' ? 'gitlab' : 'github',
    number: changeRequestNumber(card.source, metadata),
    status: reportedStatus(card.workItem?.state, metadata),
    draft: metadata.draft === true,
  };
}

/** Every pull or merge request a card carries, oldest first. */
export function cardChangeRequests(card: ChangeRequestCard): CardChangeRequest[] {
  const sources = pullRequestSources(card);
  if (sources.length > 0) return sources.map(fromSource);
  return isPullRequestCard(card) ? [fromLegacyCard(card)] : [];
}

/** The card's own pull request, else the attached one its review looks at. */
export function cardChangeRequest(card: ChangeRequestCard): CardChangeRequest | undefined {
  if (isPullRequestCard(card)) return cardChangeRequests(card)[0];
  const attached = reviewedPullRequest(card);
  return attached ? fromSource(attached) : undefined;
}
