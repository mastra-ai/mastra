import type { ExternalWorkItemSource } from './storage/domains/work-items/base.js';

/**
 * Where a card came from, in the vocabulary branch naming reads. Server rows
 * map their `externalSource` into this with {@link workItemBranchSource}; the
 * board's own `WorkItem['source']` is already this union.
 */
export type WorkItemBranchSource = 'github-issue' | 'github-pr' | 'linear-issue' | 'slack-thread' | 'manual';

export interface WorkItemBranchInput {
  id: string;
  source: WorkItemBranchSource;
  metadata?: Record<string, unknown> | null;
}

/** Map a stored item's provenance onto the source vocabulary branch naming reads. */
export function workItemBranchSource(externalSource: ExternalWorkItemSource | null | undefined): WorkItemBranchSource {
  if (!externalSource) return 'manual';
  if (externalSource.integrationId === 'linear') return 'linear-issue';
  // Only GitHub and Linear carry provider identities; anything else (a Slack
  // thread, say) is a plain work item rather than a mislabeled GitHub issue.
  if (externalSource.integrationId !== 'github') return 'manual';
  return externalSource.type === 'pull-request' ? 'github-pr' : 'github-issue';
}

function branchNumber(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key] ?? metadata.number;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
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
  if (item.source === 'github-issue') {
    const issueNumber = branchNumber(metadata, 'githubIssueNumber');
    if (issueNumber !== undefined) return `factory/issue-${issueNumber}`;
  }
  if (item.source === 'github-pr') {
    const pullRequestNumber = branchNumber(metadata, 'githubPullRequestNumber');
    if (pullRequestNumber !== undefined) return `factory/pr-${pullRequestNumber}`;
  }
  if (item.source === 'linear-issue' && typeof metadata.identifier === 'string') {
    const identifier = metadata.identifier.trim();
    if (identifier) return `factory/linear-${identifier.toLowerCase()}`;
  }
  return `factory/item-${item.id}`;
}
