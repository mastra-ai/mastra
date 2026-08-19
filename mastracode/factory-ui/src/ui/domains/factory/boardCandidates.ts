import { relativeTime } from '../../../lib/date/relativeTime';
import { AUTO_TRIAGED_LABEL, NEEDS_APPROVAL_LABEL, hasLabel } from './boardItems';
import { LINEAR_FETCH_HINT, approvalRunAction, guidedPrompt, issueRunActions, reviewRunAction } from './boardRunSpecs';
import type { RunAction } from './boardRunSpecs';
import { itemAppearsInStage } from './boardStages';
import type { GithubIssue, GithubPullRequest } from './services/factory';
import type { LinearIssue } from './services/linear';
import type { WorkItem, WorkItemSource } from './services/workItems';
import type { BoardStageId } from './stages';

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
  /** Runs the candidate can start; the first is the one-click default. */
  runActions: RunAction[];
  branch: string;
  threadTitle: string;
  customPrompt: (instructions: string) => string;
  metadata: Record<string, unknown>;
}

export function issueCandidate(issue: GithubIssue): BoardCandidate {
  const labels = issue.labels;
  const autoTriaged = hasLabel(labels, AUTO_TRIAGED_LABEL);
  const needsApproval = hasLabel(labels, NEEDS_APPROVAL_LABEL);
  const ref = `GitHub issue #${issue.number} (${issue.url})`;
  const investigateBase = `Investigate ${ref}.`;
  const approvalBase = `Prepare approval for ${ref}.`;
  return {
    sourceKey: `github-issue:${issue.number}`,
    source: 'github-issue',
    title: issue.title,
    url: issue.url,
    meta: `#${issue.number}${issue.author ? ` · ${issue.author}` : ''} · ${relativeTime(issue.createdAt)}`,
    column: autoTriaged ? 'triage' : 'intake',
    runActions: needsApproval ? [approvalRunAction(ref, issue.number)] : issueRunActions(ref, { triage: true }),
    branch: `factory/issue-${issue.number}`,
    threadTitle: needsApproval ? `Triage #${issue.number}: ${issue.title}` : `Issue #${issue.number}: ${issue.title}`,
    customPrompt: instructions => guidedPrompt(needsApproval ? approvalBase : investigateBase, instructions),
    metadata: { number: issue.number, author: issue.author, assignee: issue.assignee, labels },
  };
}

export function pullRequestCandidate(pr: GithubPullRequest): BoardCandidate {
  const ref = `GitHub pull request #${pr.number} (${pr.url})`;
  const checkout = `Check out the PR in this worktree first with \`gh pr checkout ${pr.number}\`. Expected head branch: ${pr.headBranch}.`;
  return {
    sourceKey: `github-pr:${pr.number}`,
    source: 'github-pr',
    title: pr.title,
    url: pr.url,
    meta: `#${pr.number}${pr.author ? ` · ${pr.author}` : ''} · ${pr.headBranch} → ${pr.baseBranch}`,
    column: 'intake',
    runActions: [reviewRunAction(ref, checkout)],
    branch: `factory/pr-${pr.number}`,
    threadTitle: `PR #${pr.number}: ${pr.title}`,
    customPrompt: instructions => guidedPrompt(`Review ${ref}. ${checkout}`, instructions),
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
  const ref = `Linear issue ${issue.identifier} (${issue.url})`;
  return {
    sourceKey: `linear:${issue.identifier}`,
    source: 'linear-issue',
    title: issue.title,
    url: issue.url,
    meta: `${issue.identifier} · ${issue.state}${issue.assignee ? ` · ${issue.assignee}` : ''}`,
    column: 'intake',
    runActions: issueRunActions(ref, { context: LINEAR_FETCH_HINT }),
    branch: `factory/linear-${issue.identifier.toLowerCase()}`,
    threadTitle: `${issue.identifier}: ${issue.title}`,
    customPrompt: instructions => guidedPrompt(`Investigate ${ref}. ${LINEAR_FETCH_HINT}`, instructions),
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
