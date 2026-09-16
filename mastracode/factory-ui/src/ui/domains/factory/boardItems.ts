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
  return Array.isArray(metadata.labels)
    ? metadata.labels.filter((label): label is string => typeof label === 'string')
    : [];
}

export function githubNumberForItem(item: Pick<WorkItem, 'source' | 'metadata'>): number | undefined {
  const metadataKey = item.source === 'github-issue' ? 'githubIssueNumber' : 'githubPullRequestNumber';
  const itemNumber = item.metadata[metadataKey] ?? item.metadata.number;
  if (typeof itemNumber !== 'number' || !Number.isInteger(itemNumber) || itemNumber <= 0) return;
  return itemNumber;
}

export function gitlabIdentifierForItem(item: Pick<WorkItem, 'source' | 'metadata'>): string | undefined {
  if (item.source !== 'gitlab-issue' || typeof item.metadata.identifier !== 'string') return;
  return item.metadata.identifier;
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

export function candidateSourceKeyForItem(item: WorkItem): string | undefined {
  const itemNumber = githubNumberForItem(item);
  if (itemNumber === undefined) return;
  if (item.source === 'github-issue') return `github-issue:${itemNumber}`;
  if (item.source === 'github-pr') return `github-pr:${itemNumber}`;
  return;
}

/** Aria label for the icon-only external link next to a card title. */
export function externalLinkLabel(source: WorkItemSource): string {
  if (source === 'gitlab-issue') return 'Open in GitLab';
  if (source === 'linear-issue') return 'Open in Linear';
  if (source === 'jira-issue') return 'Open in Jira';
  if (source === 'incidentio-follow-up') return 'Open in incident.io';
  if (source === 'slack-thread') return 'Open in Slack';
  if (source === 'manual') return 'Open link';
  return 'Open in GitHub';
}

export function workItemMeta(item: WorkItem): string {
  const author = typeof item.metadata.author === 'string' ? item.metadata.author : undefined;
  const assignee = typeof item.metadata.assignee === 'string' ? item.metadata.assignee : undefined;
  // Prefer when the issue/PR was opened upstream; `item.createdAt` is only
  // when the factory first saw it, which is "just now" for every backfilled card.
  const sourceCreatedAt =
    typeof item.metadata.sourceCreatedAt === 'string' && isValid(new Date(item.metadata.sourceCreatedAt))
      ? item.metadata.sourceCreatedAt
      : undefined;
  const age = relativeTime(sourceCreatedAt ?? item.createdAt);
  const githubNumber = githubNumberForItem(item);
  if (githubNumber !== undefined) return `#${githubNumber}${author ? ` · ${author}` : ''} · ${age}`;
  const issueIdentifier =
    gitlabIdentifierForItem(item) ??
    linearIdentifierForItem(item) ??
    jiraIdentifierForItem(item) ??
    incidentioIdentifierForItem(item);
  const issueOwner = assignee ?? author;
  if (issueIdentifier !== undefined) return `${issueIdentifier}${issueOwner ? ` · ${issueOwner}` : ''} · ${age}`;
  return `${SOURCE_LABELS[item.source]} · ${age}`;
}

/** Free-text card match over what names it on the board: its title and its issue key. */
export function cardMatchesSearch(card: Pick<WorkItem, 'source' | 'metadata' | 'title'>, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  const number = githubNumberForItem(card);
  const identifier =
    gitlabIdentifierForItem(card) ??
    linearIdentifierForItem(card) ??
    jiraIdentifierForItem(card) ??
    incidentioIdentifierForItem(card);
  const named = [card.title, number === undefined ? '' : `#${number}`, identifier ?? ''];
  return named.some(text => text.toLowerCase().includes(needle));
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
 * still carry divergent role refs; the last-filed ref wins (runs converge them
 * back onto one thread the next time they file).
 */
export function itemThreadSession(sessions: Record<string, WorkItemSessionRef>): WorkItemSessionRef | undefined {
  return Object.values(sessions).at(-1);
}

/** Source keys already materialized as cards, in either workflow — candidates matching one are dropped. */
export function persistedSourceKeys(items: readonly WorkItem[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.sourceKey) keys.add(item.sourceKey);
    const candidateSourceKey = candidateSourceKeyForItem(item);
    if (candidateSourceKey) keys.add(candidateSourceKey);
  }
  return keys;
}
