import { relativeTime } from '../../../lib/date/relativeTime';
import { AUTO_TRIAGED_LABEL, hasLabel } from './boardItems';
import { itemAppearsInStage } from './boardStages';
import type { GithubIssue, GithubPullRequest } from './services/factory';
import type { LinearIssue } from './services/linear';
import type { WorkItem, WorkItemSource } from './services/workItems';
import type { BoardStageId } from './stages';

/**
 * The run the card's move starts already knows which issue or PR it is about,
 * so typed guidance travels alone.
 */
function guidance(instructions: string): string {
  return `Guidance for this run: ${instructions}`;
}

/**
 * Candidate feeds the Intake swimlane can browse. Only one paginated list is
 * shown at a time; a pill switcher inside the column picks the active feed
 * when more than one is available.
 */
export const INTAKE_SOURCES = [
  { id: 'github', label: 'Issues' },
  { id: 'github-prs', label: 'PRs' },
  { id: 'linear', label: 'Linear' },
] as const;

export type IntakeSource = (typeof INTAKE_SOURCES)[number]['id'];

/** What a candidate feed exposes to the column rendering it. */
export interface IntakeFeed {
  error: Error | null;
  /** Set when the failure came from paging, not from the stored pages. */
  isFetchNextPageError?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage: () => unknown;
  refetch: () => unknown;
}

/** A live GitHub/Linear issue or PR that has not been materialized as a work item. */
export interface BoardCandidate {
  sourceKey: string;
  source: WorkItemSource;
  title: string;
  url: string;
  /** Meta line under the title, e.g. `#12 · alice · opened 3 days ago`. */
  meta: string;
  /** Column the candidate is offered in: everything starts in Intake (auto-triaged issues in Triage). */
  column: BoardStageId;
  /** Frames typed guidance for the run the card's move will start; posted as the card's first comment. */
  customPrompt: (instructions: string) => string;
  metadata: Record<string, unknown>;
}

export function issueCandidate(issue: GithubIssue): BoardCandidate {
  const labels = issue.labels;
  return {
    sourceKey: `github-issue:${issue.number}`,
    source: 'github-issue',
    title: issue.title,
    url: issue.url,
    meta: `#${issue.number}${issue.author ? ` · ${issue.author}` : ''} · ${relativeTime(issue.createdAt)}`,
    column: hasLabel(labels, AUTO_TRIAGED_LABEL) ? 'triage' : 'intake',
    customPrompt: guidance,
    metadata: { number: issue.number, author: issue.author, assignee: issue.assignee, labels },
  };
}

export function pullRequestCandidate(pr: GithubPullRequest): BoardCandidate {
  return {
    sourceKey: `github-pr:${pr.number}`,
    source: 'github-pr',
    title: pr.title,
    url: pr.url,
    meta: `#${pr.number}${pr.author ? ` · ${pr.author}` : ''} · ${pr.headBranch} → ${pr.baseBranch}`,
    column: 'intake',
    customPrompt: guidance,
    metadata: {
      number: pr.number,
      author: pr.author,
      assignees: pr.assignees ?? [],
      requestedReviewers: pr.requestedReviewers ?? [],
      headBranch: pr.headBranch,
      baseBranch: pr.baseBranch,
    },
  };
}

export function linearCandidate(issue: LinearIssue): BoardCandidate {
  return {
    sourceKey: `linear:${issue.identifier}`,
    source: 'linear-issue',
    title: issue.title,
    url: issue.url,
    meta: `${issue.identifier} · ${issue.state}${issue.assignee ? ` · ${issue.assignee}` : ''}`,
    column: 'intake',
    customPrompt: guidance,
    metadata: {
      identifier: issue.identifier,
      state: issue.state,
      assignee: issue.assignee,
      creator: issue.creator ?? null,
    },
  };
}

export function stageContentCount(
  stage: BoardStageId,
  stages: ReadonlyArray<{ id: BoardStageId }>,
  workItems: readonly WorkItem[],
  candidates: readonly BoardCandidate[],
): number {
  let count = candidates.filter(candidate => candidate.column === stage).length;
  for (const item of workItems) {
    if (itemAppearsInStage(item, stage, stages)) count += 1;
  }
  return count;
}
