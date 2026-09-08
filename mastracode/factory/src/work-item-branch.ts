import type { ExternalWorkItemSource } from './storage/domains/work-items/base.js';

/**
 * Where a card came from, in the vocabulary branch naming reads. Server rows
 * map their `externalSource` into this with {@link workItemBranchSource}; the
 * board's own `WorkItem['source']` is already this union.
 */
export type WorkItemBranchSource =
  | 'github-issue'
  | 'github-pr'
  | 'linear-issue'
  | 'gitlab-issue'
  | 'slack-thread'
  | 'manual';

export interface WorkItemBranchInput {
  id: string;
  source: WorkItemBranchSource;
  metadata?: Record<string, unknown> | null;
}

/** Map a stored item's provenance onto the source vocabulary branch naming reads. */
export function workItemBranchSource(externalSource: ExternalWorkItemSource | null | undefined): WorkItemBranchSource {
  if (!externalSource) return 'manual';
  if (externalSource.integrationId === 'linear') return 'linear-issue';
  if (externalSource.integrationId === 'gitlab') return 'gitlab-issue';
  // Only GitHub, Linear, and GitLab carry provider identities; anything else (a
  // Slack thread, say) is a plain work item rather than a mislabeled GitHub issue.
  if (externalSource.integrationId !== 'github') return 'manual';
  return externalSource.type === 'pull-request' ? 'github-pr' : 'github-issue';
}

function branchNumber(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key] ?? metadata.number;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

/** The provider number a GitHub card carries — the `#12` its runs and thread titles name it by. */
export function workItemNumber(item: Pick<WorkItemBranchInput, 'source' | 'metadata'>): number | undefined {
  const metadata = item.metadata ?? {};
  if (item.source === 'github-issue') return branchNumber(metadata, 'githubIssueNumber');
  if (item.source === 'github-pr') return branchNumber(metadata, 'githubPullRequestNumber');
  return;
}

/** How a card names its thread: a Linear title already opens with its identifier, a GitHub card gets its number here. */
export function workItemThreadTitle(
  item: Pick<WorkItemBranchInput, 'source' | 'metadata'> & { title: string },
): string {
  const number = workItemNumber(item);
  if (number === undefined) return item.title;
  return `${item.source === 'github-pr' ? 'PR' : 'Issue'} #${number}: ${item.title}`;
}

/**
 * The git branch an item's runs and sessions share, one grammar for both sides
 * of the wire: the dispatcher names autonomous run branches with it and the
 * board opens card sessions on it, so both converge on one checkout per item.
 * Cards without a provider identity (manual, Slack) and cards whose metadata
 * lost their identifier fall back to the id-derived branch.
 */
export function workItemBranch(item: WorkItemBranchInput): string {
  const metadata = item.metadata ?? {};
  const githubNumber = workItemNumber(item);
  if (githubNumber !== undefined) {
    return item.source === 'github-issue' ? `factory/issue-${githubNumber}` : `factory/pr-${githubNumber}`;
  }
  if (item.source === 'linear-issue' && typeof metadata.identifier === 'string') {
    const identifier = metadata.identifier.trim();
    if (identifier) return `factory/linear-${identifier.toLowerCase()}`;
  }
  // GitLab identifiers are paths (`group/project#7`), which cannot go in a
  // branch name as-is: `#` is invalid and the slashes would nest refs under a
  // directory that collides with `factory/`. The per-project iid is what makes
  // it readable, so `group/project#7` becomes `factory/gitlab-7`.
  if (item.source === 'gitlab-issue') {
    const iid = branchNumber(metadata, 'iid');
    if (iid !== undefined) return `factory/gitlab-${iid}`;
  }
  return `factory/item-${item.id}`;
}

/** The pull request a `factory/pr-<number>` branch was named after, the inverse of {@link workItemBranch}. */
export function pullRequestNumberFromBranch(branch: string): number | undefined {
  const match = /^factory\/pr-([1-9]\d*)$/.exec(branch);
  return match ? Number(match[1]) : undefined;
}
