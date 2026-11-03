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

export function sourceMetadata(item: Pick<WorkItem, 'metadata' | 'workItem'>): Record<string, unknown> {
  if (!item.workItem || item.workItem.provider === 'factory') return item.metadata;
  return {
    ...item.workItem.metadata,
    labels: item.workItem.labels,
    author: item.workItem.author,
    state: item.workItem.state,
    identifier: item.workItem.key,
  };
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

export function githubNumberForItem(item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>): number | undefined {
  const metadata = sourceMetadata(item);
  if (item.source !== 'github-issue' && item.source !== 'github-pr') return;
  const metadataKey = item.source === 'github-issue' ? 'githubIssueNumber' : 'githubPullRequestNumber';
  const itemNumber = metadata[metadataKey] ?? metadata.number;
  if (typeof itemNumber !== 'number' || !Number.isInteger(itemNumber) || itemNumber <= 0) return;
  return itemNumber;
}

export function changeRequestNumberForItem(
  item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>,
): number | undefined {
  const metadata = sourceMetadata(item);
  if (item.source === 'github-pr') return githubNumberForItem(item);
  if (item.source !== 'gitlab-pr') return;
  const iid = metadata.gitlabMergeRequestIid;
  return typeof iid === 'number' && Number.isSafeInteger(iid) && iid > 0 ? iid : undefined;
}

export function gitlabIdentifierForItem(item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>): string | undefined {
  const metadata = sourceMetadata(item);
  if (item.source === 'gitlab-issue' && typeof metadata.identifier === 'string') return metadata.identifier;
  if (item.source !== 'gitlab-pr') return;
  const iid = metadata.gitlabMergeRequestIid;
  return typeof iid === 'number' && Number.isSafeInteger(iid) && iid > 0 ? `!${iid}` : undefined;
}

export function linearIdentifierForItem(item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>): string | undefined {
  const metadata = sourceMetadata(item);
  if (item.source !== 'linear-issue' || typeof metadata.identifier !== 'string') return;
  return metadata.identifier;
}

export function linearIssueIdForItem(item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>): string | undefined {
  const metadata = sourceMetadata(item);
  if (item.source !== 'linear-issue' || typeof metadata.linearIssueId !== 'string') return;
  return metadata.linearIssueId;
}

export function jiraIdentifierForItem(item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>): string | undefined {
  const metadata = sourceMetadata(item);
  if (item.source !== 'jira-issue' || typeof metadata.identifier !== 'string') return;
  return metadata.identifier;
}

export function jiraIssueRefForItem(item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>): string | undefined {
  const metadata = sourceMetadata(item);
  if (item.source !== 'jira-issue') return;
  return nonEmptyString(metadata.issueRef) ?? nonEmptyString(metadata.issueReference);
}

export function incidentioIdentifierForItem(
  item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>,
): string | undefined {
  const metadata = sourceMetadata(item);
  if (item.source !== 'incidentio-follow-up' || typeof metadata.identifier !== 'string') return;
  return metadata.identifier;
}

export function incidentioIssueRefForItem(
  item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>,
): string | undefined {
  const metadata = sourceMetadata(item);
  if (item.source !== 'incidentio-follow-up') return;
  return nonEmptyString(metadata.issueRef) ?? nonEmptyString(metadata.issueReference);
}

// Legacy rows may carry an empty issueRef beside a populated issueReference.
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

export function pullRequestStatusForItem(item: Pick<WorkItem, 'workItem' | 'metadata' | 'stages'>): PullRequestStatus {
  const metadata = sourceMetadata(item);
  if (metadata.state === 'merged' || metadata.merged === true) return 'merged';
  if (metadata.state === 'closed') return 'closed';
  if (metadata.state === 'open') return metadata.draft === true ? 'draft' : 'open';
  if (item.stages.includes('done')) return 'merged';
  if (item.stages.includes('canceled')) return 'closed';
  return metadata.draft === true ? 'draft' : 'open';
}

export function githubSourceKey(kind: 'issue' | 'pull-request', itemNumber: number, repositoryId?: number): string {
  if (repositoryId !== undefined) return `github:${repositoryId}:${kind}:${itemNumber}`;
  return kind === 'issue' ? `github-issue:${itemNumber}` : `github-pr:${itemNumber}`;
}

export function candidateSourceKeyForItem(item: WorkItem): string | undefined {
  const metadata = sourceMetadata(item);
  const itemNumber = githubNumberForItem(item);
  if (itemNumber === undefined) return;
  const repositoryId = typeof metadata.githubRepositoryId === 'number' ? metadata.githubRepositoryId : undefined;
  if (item.source === 'github-issue') return githubSourceKey('issue', itemNumber, repositoryId);
  if (item.source === 'github-pr') return githubSourceKey('pull-request', itemNumber, repositoryId);
  return undefined;
}

export function externalLinkLabel(source: WorkItemSource): string {
  if (source === 'gitlab-issue' || source === 'gitlab-pr') return 'Open in GitLab';
  if (source === 'linear-issue') return 'Open in Linear';
  if (source === 'jira-issue') return 'Open in Jira';
  if (source === 'incidentio-follow-up') return 'Open in incident.io';
  if (source === 'slack-thread') return 'Open in Slack';
  if (source === 'manual') return 'Open link';
  return 'Open in GitHub';
}

export function sourceCreatedAt(metadata: Record<string, unknown>): string | undefined {
  const value = metadata.sourceCreatedAt;
  return typeof value === 'string' && isValid(new Date(value)) ? value : undefined;
}

export function doneAt(item: Pick<WorkItem, 'stages' | 'stageHistory'>): number | undefined {
  if (!item.stages.includes('done')) return undefined;
  const entry = item.stageHistory.findLast(candidate => candidate.stage === 'done');
  return entry && Date.parse(entry.enteredAt);
}

export function workItemKey(item: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>): string | undefined {
  if (item.workItem?.provider !== 'factory' && item.workItem?.key) return item.workItem.key;
  const githubNumber = githubNumberForItem(item);
  if (githubNumber !== undefined) return `#${githubNumber}`;
  return (
    gitlabIdentifierForItem(item) ??
    linearIdentifierForItem(item) ??
    jiraIdentifierForItem(item) ??
    incidentioIdentifierForItem(item)
  );
}

export function workItemMeta(item: WorkItem): readonly string[] {
  const metadata = sourceMetadata(item);
  const author = typeof metadata.author === 'string' ? metadata.author : undefined;
  const assignee = typeof metadata.assignee === 'string' ? metadata.assignee : undefined;
  const age = relativeTime(sourceCreatedAt(metadata) ?? item.createdAt);
  const key = workItemKey(item);
  if (key === undefined) return [SOURCE_LABELS[item.source], age];
  const owner = githubNumberForItem(item) === undefined ? (assignee ?? author) : author;
  return [key, ...(owner ? [owner] : []), age];
}

export function cardMatchesSearch(
  card: Pick<WorkItem, 'source' | 'workItem' | 'metadata' | 'title'>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return [card.title, workItemKey(card) ?? ''].some(text => text.toLowerCase().includes(needle));
}

export function itemSessionSpec(item: WorkItem): { branch: string; threadTitle: string } {
  const input = { ...item, metadata: { ...item.metadata, ...sourceMetadata(item) } };
  return { branch: workItemBranch(input), threadTitle: workItemThreadTitle(input) };
}

// Legacy rows may reference multiple sessions; prefer the earliest lifecycle role.
export function itemThreadSession(sessions: Record<string, WorkItemSessionRef>): WorkItemSessionRef | undefined {
  return (
    sessions.triage ?? sessions.plan ?? sessions.work ?? sessions.review ?? sessions.chat ?? Object.values(sessions)[0]
  );
}

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

export function isPersistedCandidate(
  keys: ReadonlySet<string>,
  candidate: { sourceKey: string; url: string },
): boolean {
  return keys.has(candidate.sourceKey) || keys.has(candidate.url);
}
