import { relativeTime } from '../../../lib/date/relativeTime';
import type { WorkItem, WorkItemSessionRef, WorkItemSource } from './services/workItems';

export const AUTO_TRIAGED_LABEL = 'status: auto-triaged';
export const NEEDS_APPROVAL_LABEL = 'status: needs approval';
export const HIDDEN_CARD_LABELS = new Set([AUTO_TRIAGED_LABEL, NEEDS_APPROVAL_LABEL]);

export const SOURCE_LABELS: Record<WorkItemSource, string> = {
  'github-issue': 'Issue',
  'github-pr': 'PR Review',
  'linear-issue': 'Linear',
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
  if (source === 'linear-issue') return 'Open in Linear';
  if (source === 'slack-thread') return 'Open in Slack';
  if (source === 'manual') return 'Open link';
  return 'Open in GitHub';
}

export function workItemMeta(item: WorkItem): string {
  const author = typeof item.metadata.author === 'string' ? item.metadata.author : undefined;
  const age = relativeTime(item.createdAt);
  const githubNumber = githubNumberForItem(item);
  if (githubNumber !== undefined) return `#${githubNumber}${author ? ` · ${author}` : ''} · ${age}`;
  if (item.source === 'linear-issue' && typeof item.metadata.identifier === 'string') {
    return `${item.metadata.identifier}${author ? ` · ${author}` : ''} · ${age}`;
  }
  return `${SOURCE_LABELS[item.source]} · ${age}`;
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

/** Session refs whose worktree was deleted are stale: their thread went with it. */
export function liveSessions(
  sessions: Record<string, WorkItemSessionRef>,
  liveWorktreePaths: ReadonlySet<string>,
): Record<string, WorkItemSessionRef> {
  return Object.fromEntries(Object.entries(sessions).filter(([, session]) => liveWorktreePaths.has(session.sessionId)));
}
