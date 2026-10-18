import { AUTO_TRIAGED_LABEL, NEEDS_APPROVAL_LABEL } from '@mastra/factory/rules/types';
import { workItemBranch, workItemThreadTitle } from '@mastra/factory/work-item-branch';
import { isValid } from 'date-fns';

import { relativeTime } from '../../../lib/date/relativeTime';
import type { WorkItem, WorkItemSessionRef, WorkItemSource } from './services/workItems';

export const HIDDEN_CARD_LABELS = new Set([AUTO_TRIAGED_LABEL, NEEDS_APPROVAL_LABEL]);

export const SOURCE_LABELS: Record<WorkItemSource, string> = {
  'github-issue': 'Issue',
  'github-pr': 'PR Review',
  'gitlab-issue': 'GitLab',
  'gitlab-pr': 'MR Review',
  'linear-issue': 'Linear',
  'jira-issue': 'Jira',
  'incidentio-follow-up': 'incident.io',
  'slack-thread': 'Slack',
  manual: 'Manual',
};

export function hasLabel(labels: readonly string[], label: string): boolean {
  return labels.some(item => item.toLowerCase() === label);
}

export function metadataLabels(metadata: Record<string, unknown>): string[] {
  if (!Array.isArray(metadata.labels)) return [];
  return metadata.labels.filter((label): label is string => typeof label === 'string');
}

export function metadataLabelColors(metadata: Record<string, unknown>): Record<string, string> {
  if (!metadata.labelColors || typeof metadata.labelColors !== 'object' || Array.isArray(metadata.labelColors))
    return {};
  return Object.fromEntries(
    Object.entries(metadata.labelColors).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' &&
        (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(entry[1]) || /^[a-z]+$/i.test(entry[1])),
    ),
  );
}

export function githubNumberForItem(item: Pick<WorkItem, 'source' | 'metadata'>): number | undefined {
  if (item.source !== 'github-issue' && item.source !== 'github-pr') return;
  const metadataKey = item.source === 'github-issue' ? 'githubIssueNumber' : 'githubPullRequestNumber';
  const itemNumber = item.metadata[metadataKey] ?? item.metadata.number;
  if (typeof itemNumber !== 'number' || !Number.isInteger(itemNumber) || itemNumber <= 0) return;
  return itemNumber;
}

/** The change-request number a review card carries: a GitHub PR number or a GitLab MR iid. */
export function changeRequestNumberForItem(item: Pick<WorkItem, 'source' | 'metadata'>): number | undefined {
  if (item.source === 'github-pr') return githubNumberForItem(item);
  if (item.source !== 'gitlab-pr') return;
  const iid = item.metadata.gitlabMergeRequestIid;
  return typeof iid === 'number' && Number.isSafeInteger(iid) && iid > 0 ? iid : undefined;
}

export function gitlabIdentifierForItem(item: Pick<WorkItem, 'source' | 'metadata'>): string | undefined {
  if (item.source === 'gitlab-issue' && typeof item.metadata.identifier === 'string') return item.metadata.identifier;
  if (item.source !== 'gitlab-pr') return;
  const iid = item.metadata.gitlabMergeRequestIid;
  return typeof iid === 'number' && Number.isSafeInteger(iid) && iid > 0 ? `!${iid}` : undefined;
}

/** The human issue key a Linear card carries (`ENG-123`), when it has one. */
export function linearIdentifierForItem(item: Pick<WorkItem, 'source' | 'metadata'>): string | undefined {
  if (item.source !== 'linear-issue' || typeof item.metadata.identifier !== 'string') return;
  return item.metadata.identifier;
}
/** The opaque Linear issue id a card carries, when it has one. */
export function linearIssueIdForItem(item: Pick<WorkItem, 'source' | 'metadata'>): string | undefined {
  if (item.source !== 'linear-issue' || typeof item.metadata.linearIssueId !== 'string') return;
  return item.metadata.linearIssueId;
}

export function jiraIdentifierForItem(item: Pick<WorkItem, 'source' | 'metadata'>): string | undefined {
  if (item.source !== 'jira-issue' || typeof item.metadata.identifier !== 'string') return;
  return item.metadata.identifier;
}

export function jiraIssueRefForItem(item: Pick<WorkItem, 'source' | 'metadata'>): string | undefined {
  if (item.source !== 'jira-issue') return;
  return nonEmptyString(item.metadata.issueRef) ?? nonEmptyString(item.metadata.issueReference);
}

/** The human reference an incident.io follow-up card carries (`INC-42` or the item id), when it has one. */
export function incidentioIdentifierForItem(item: Pick<WorkItem, 'source' | 'metadata'>): string | undefined {
  if (item.source !== 'incidentio-follow-up' || typeof item.metadata.identifier !== 'string') return;
  return item.metadata.identifier;
}

/** The prefixed incident.io item reference a card carries, when it has one. */
export function incidentioIssueRefForItem(item: Pick<WorkItem, 'source' | 'metadata'>): string | undefined {
  if (item.source !== 'incidentio-follow-up') return;
  return nonEmptyString(item.metadata.issueRef) ?? nonEmptyString(item.metadata.issueReference);
}

/** Legacy metadata may hold `issueRef: ''` beside a populated `issueReference`; skip empty values. */
function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

export type PullRequestStatus = 'draft' | 'open' | 'closed' | 'merged';

export const PULL_REQUEST_STATUS_LABELS: Record<PullRequestStatus, string> = {
  draft: 'Draft pull request',
  open: 'Open pull request',
  closed: 'Closed pull request',
  merged: 'Merged pull request',
};

export function pullRequestStatusForItem(item: Pick<WorkItem, 'metadata' | 'stages'>): PullRequestStatus {
  if (item.metadata.merged === true) return 'merged';
  if (item.metadata.state === 'closed') return 'closed';
  if (item.metadata.state === 'open') return item.metadata.draft === true ? 'draft' : 'open';
  if (item.stages.includes('done')) return 'merged';
  if (item.stages.includes('canceled')) return 'closed';
  return item.metadata.draft === true ? 'draft' : 'open';
}

/**
 * Source key for a GitHub issue or pull request. Numbers repeat across a
 * project's repositories, so the key is repository-scoped whenever the
 * repository is known; the bare-number form remains for legacy callers.
 */
export function githubSourceKey(kind: 'issue' | 'pull-request', itemNumber: number, repositoryId?: number): string {
  if (repositoryId !== undefined) return `github:${repositoryId}:${kind}:${itemNumber}`;
  return kind === 'issue' ? `github-issue:${itemNumber}` : `github-pr:${itemNumber}`;
}

/**
 * The candidate source key a card stands for. Cards stamped with their
 * repository match only that repository's candidate, even when the card
 * itself still carries a bare-number key from before keys were scoped.
 */
export function candidateSourceKeyForItem(item: WorkItem): string | undefined {
  const itemNumber = githubNumberForItem(item);
  if (itemNumber === undefined) return;
  const repositoryId =
    typeof item.metadata.githubRepositoryId === 'number' ? item.metadata.githubRepositoryId : undefined;
  if (item.source === 'github-issue') return githubSourceKey('issue', itemNumber, repositoryId);
  if (item.source === 'github-pr') return githubSourceKey('pull-request', itemNumber, repositoryId);
  return;
}

/** Aria label for the icon-only external link next to a card title. */
export function externalLinkLabel(source: WorkItemSource): string {
  if (source === 'gitlab-issue' || source === 'gitlab-pr') return 'Open in GitLab';
  if (source === 'linear-issue') return 'Open in Linear';
  if (source === 'jira-issue') return 'Open in Jira';
  if (source === 'incidentio-follow-up') return 'Open in incident.io';
  if (source === 'slack-thread') return 'Open in Slack';
  if (source === 'manual') return 'Open link';
  return 'Open in GitHub';
}

/** When the issue/PR was opened upstream; `createdAt` is only when the factory first saw it, "just now" for every backfilled card. */
export function sourceCreatedAt(metadata: Record<string, unknown>): string | undefined {
  const value = metadata.sourceCreatedAt;
  return typeof value === 'string' && isValid(new Date(value)) ? value : undefined;
}

/** The upstream key a card is known by: `#123` on GitHub, `ENG-42` on Linear. */
export function workItemKey(item: Pick<WorkItem, 'source' | 'metadata'>): string | undefined {
  const githubNumber = githubNumberForItem(item);
  if (githubNumber !== undefined) return `#${githubNumber}`;
  return (
    gitlabIdentifierForItem(item) ??
    linearIdentifierForItem(item) ??
    jiraIdentifierForItem(item) ??
    incidentioIdentifierForItem(item)
  );
}

export function workItemMeta(item: WorkItem): string {
  const author = typeof item.metadata.author === 'string' ? item.metadata.author : undefined;
  const assignee = typeof item.metadata.assignee === 'string' ? item.metadata.assignee : undefined;
  const age = relativeTime(sourceCreatedAt(item.metadata) ?? item.createdAt);
  const key = workItemKey(item);
  if (key === undefined) return `${SOURCE_LABELS[item.source]} · ${age}`;
  const owner = githubNumberForItem(item) === undefined ? (assignee ?? author) : author;
  return `${key}${owner ? ` · ${owner}` : ''} · ${age}`;
}

/** Free-text card match over what names it on the board: its title and its issue key. */
export function cardMatchesSearch(card: Pick<WorkItem, 'source' | 'metadata' | 'title'>, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return [card.title, workItemKey(card) ?? ''].some(text => text.toLowerCase().includes(needle));
}

/**
 * Branch + thread title for a card's session, shared with the server's runs
 * (`workItemBranch`), so the title click and a later run converge on one
 * worktree.
 */
export function itemSessionSpec(item: WorkItem): { branch: string; threadTitle: string } {
  return { branch: workItemBranch(item), threadTitle: workItemThreadTitle(item) };
}

/**
 * The card's single conversation. A work item keeps one threadId for its whole
 * lifecycle — every run reuses the worktree's thread — so the card title links
 * to exactly one thread. Items filed while session scoping was broken may
 * still carry divergent role refs; prefer the earliest lifecycle role because
 * JSON object key order is not a stable record of which ref was filed first.
 */
export function itemThreadSession(sessions: Record<string, WorkItemSessionRef>): WorkItemSessionRef | undefined {
  return (
    sessions.triage ?? sessions.plan ?? sessions.work ?? sessions.review ?? sessions.chat ?? Object.values(sessions)[0]
  );
}

/** Source keys already materialized as cards, in either workflow — candidates matching one are dropped. */
export function persistedSourceKeys(items: readonly WorkItem[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.sourceKey) keys.add(item.sourceKey);
    const candidateSourceKey = candidateSourceKeyForItem(item);
    if (candidateSourceKey) keys.add(candidateSourceKey);
    // The URL names the repository, covering cards filed before they were stamped with one.
    if (item.url && (item.source === 'github-issue' || item.source === 'github-pr')) keys.add(item.url);
  }
  return keys;
}

/** Whether a live candidate is already one of the given persisted cards. */
export function isPersistedCandidate(
  keys: ReadonlySet<string>,
  candidate: { sourceKey: string; url: string },
): boolean {
  return keys.has(candidate.sourceKey) || keys.has(candidate.url);
}
