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

/**
 * On a pull request's source metadata: the ids of the other cards of issues it closes, besides
 * the card holding it. They link to it without holding it; see `closingLinksIn`.
 */
export const CLOSES_WORK_ITEM_IDS_KEY = 'closesWorkItemIds';

/** The cards a pull request source closes besides the one holding it. */
export function closedWorkItemIds(source: Pick<WorkItemSourceRow, 'metadata'>): string[] {
  const listed = source.metadata?.[CLOSES_WORK_ITEM_IDS_KEY];
  return Array.isArray(listed) ? listed.filter((id): id is string => typeof id === 'string') : [];
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
 * Card metadata listing the attached pull requests whose author had no write access, as
 * `<provider>:<externalId>`. Before any author's pull request could join a card only trusted
 * ones did, so a source missing from the list is trusted.
 */
export const UNTRUSTED_PULL_REQUESTS_KEY = 'untrustedPullRequests';

/** The key {@link UNTRUSTED_PULL_REQUESTS_KEY} lists a source under. */
export function pullRequestTrustKey(source: Pick<WorkItemSourceRow, 'provider' | 'externalId'>): string {
  return `${source.provider}:${source.externalId}`;
}

/** Whether a pull request attached to the card was opened by someone with write access (or by Factory). */
export function trustedPullRequestSource(
  item: { readonly metadata?: Record<string, unknown> | null },
  source: Pick<WorkItemSourceRow, 'provider' | 'externalId'>,
): boolean {
  const untrusted = item.metadata?.[UNTRUSTED_PULL_REQUESTS_KEY];
  return !(Array.isArray(untrusted) && untrusted.includes(pullRequestTrustKey(source)));
}

function closedUnmerged(source: Pick<WorkItemSourceRow, 'state' | 'metadata'>): boolean {
  return (
    !isOpenPullRequestSource(source) &&
    (source.state ?? source.metadata?.state) !== 'merged' &&
    source.metadata?.merged !== true
  );
}

/**
 * The card's working pull request, the one its review passes and status checks follow: the one
 * `openPullRequestNumber` names (its session's own, or the one a person picked), unless it closed
 * without merging; else the first trusted open one linked, else the first trusted merged one. An
 * outsider's pull request is never picked on its own. `except` leaves one pull request out.
 */
export function workingPullRequest(
  item: SourcedItem & { readonly metadata?: Record<string, unknown> | null },
  except?: number,
): WorkItemSourceRow | undefined {
  const sources = pullRequestSources(item).filter(
    source => !closedUnmerged(source) && (except === undefined || pullRequestSourceNumber(source) !== except),
  );
  const pointer = item.metadata?.openPullRequestNumber;
  return (
    (typeof pointer === 'number' ? sources.find(source => pullRequestSourceNumber(source) === pointer) : undefined) ??
    sources.find(source => isOpenPullRequestSource(source) && trustedPullRequestSource(item, source)) ??
    sources.find(source => trustedPullRequestSource(item, source))
  );
}

/**
 * The pull request `openPullRequestNumber` names, unless it is one linked to the card that closed
 * without merging: the card then works on its {@link workingPullRequest} instead. A pointer to a
 * pull request the card has no source for (its session opened it) stands.
 */
export function pointedPullRequest(
  item: SourcedItem & { readonly metadata?: Record<string, unknown> | null },
): number | undefined {
  const pointer = item.metadata?.openPullRequestNumber;
  if (typeof pointer !== 'number') return undefined;
  const source = pullRequestSources(item).find(entry => pullRequestSourceNumber(entry) === pointer);
  return source && closedUnmerged(source) ? undefined : pointer;
}

/** The pull request a PR review pass on this card reviews: its {@link workingPullRequest}. */
export function reviewedPullRequest(
  item: SourcedItem & { readonly metadata?: Record<string, unknown> | null },
): WorkItemSourceRow | undefined {
  return workingPullRequest(item);
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

/**
 * The card's own pull request, else the attached one to show on it: the one `openPullRequestNumber`
 * names, else the newest open one, else the newest one. Unlike {@link reviewedPullRequest} it shows
 * a closed or an outsider's pull request, since showing one starts no work on it.
 */
export function cardChangeRequest(card: ChangeRequestCard): CardChangeRequest | undefined {
  if (isPullRequestCard(card)) return cardChangeRequests(card)[0];
  const sources = pullRequestSources(card);
  const pointer = card.metadata?.openPullRequestNumber;
  const attached =
    (typeof pointer === 'number' ? sources.find(source => pullRequestSourceNumber(source) === pointer) : undefined) ??
    sources.findLast(isOpenPullRequestSource) ??
    sources.at(-1);
  return attached ? fromSource(attached) : undefined;
}
