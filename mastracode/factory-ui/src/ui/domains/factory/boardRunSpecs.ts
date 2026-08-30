import { workItemBranch } from '@mastra/factory/work-item-branch';
import type { FactoryRunInvocation, FactoryRunPhase } from '../../../hooks/useStartFactoryRun';
import { NEEDS_APPROVAL_LABEL, githubNumberForItem, hasLabel, metadataLabels } from './boardItems';
import type { WorkItem } from './services/workItems';
import type { BoardStageId } from './stages';

export const RUN_PHASE_LABELS: Record<FactoryRunPhase, string> = {
  workspace: 'preparing workspace…',
  kickoff: 'starting agent…',
  opening: 'opening thread…',
};

/**
 * One agent run a card or candidate can start, and the lane it lands the card
 * in. Cards offer several: e.g. an issue can be investigated (understand it →
 * Planning) or built right away (implement it → Building). All of an item's
 * runs share one branch/worktree, so a later run continues the same
 * conversation as a follow-up.
 */
export interface RunAction {
  label: 'Investigate' | 'Build' | 'Prepare approval' | 'Review';
  /** Session slot the run fills on the card, e.g. `plan` or `work`. */
  role: 'triage' | 'plan' | 'work' | 'review';
  /** Lane the card lands in once the run is underway. */
  stage: BoardStageId;
  invocation: FactoryRunInvocation;
  threadTags?: Record<string, string>;
}

export interface ItemRunSpec {
  branch: string;
  threadTitle: string;
  /** Runs the card can start; each lands the card in its own lane. */
  actions: RunAction[];
}

function issueTriageThreadTags(issueNumber: number): Record<string, string> {
  return { role: 'triage', source: 'github-issue', purpose: 'issue-triage', issueNumber: String(issueNumber) };
}

/**
 * Custom prompts keep the same base context as the default run (what the
 * issue/PR is and how to pick it up) — the typed text guides the run instead
 * of directing an explicit skill.
 */
export function guidedPrompt(base: string, instructions: string): string {
  return `${base}\n\nGuidance for this run: ${instructions}`;
}

/** Investigate an issue, then Build it when needed. */
export function issueRunActions(ref: string, extra?: { context?: string; triage?: boolean }): RunAction[] {
  const context = extra?.context ? `\n\n${extra.context}` : '';
  const role = extra?.triage ? 'triage' : 'plan';
  const stage = extra?.triage ? 'triage' : 'planning';
  return [
    {
      label: 'Investigate',
      role,
      stage,
      invocation: {
        type: 'skill',
        skillName: 'factory-triage',
        arguments: `${ref}${context}`,
      },
    },
    {
      label: 'Build',
      role: 'work',
      stage: 'execute',
      invocation: {
        type: 'prompt',
        prompt: `Implement a fix for ${ref}: investigate the root cause, make the change with tests, and open a pull request.${extra?.context ? ` ${extra.context}` : ''}`,
      },
    },
  ];
}

export function approvalRunAction(ref: string, issueNumber: number): RunAction {
  return {
    label: 'Prepare approval',
    role: 'triage',
    stage: 'triage',
    invocation: {
      type: 'prompt',
      prompt: `Prepare approval for ${ref}. Review the existing triage comment and summarize the decision needed before implementation or closure.`,
    },
    threadTags: issueTriageThreadTags(issueNumber),
  };
}

export function reviewRunAction(ref: string, checkout: string): RunAction {
  return {
    label: 'Review',
    role: 'review',
    stage: 'review',
    invocation: {
      type: 'skill',
      skillName: 'factory-review',
      arguments: `${ref}\n\n${checkout}`,
    },
  };
}

export const LINEAR_FETCH_HINT = `Start by fetching the issue's full details (description and comments) with the linear_get_issue tool.`;

/**
 * The runs a persisted card can start, derived from its source + metadata.
 * Issues can be investigated (→ Planning) or built (→ Building); PRs get a
 * review run. Manual cards (or cards missing the needed metadata) can't
 * start runs.
 */
export function itemRunSpec(item: WorkItem): ItemRunSpec | undefined {
  const meta = item.metadata;
  const githubNumber = githubNumberForItem(item);
  if (item.source === 'github-issue' && githubNumber !== undefined) {
    const needsApproval = hasLabel(metadataLabels(meta), NEEDS_APPROVAL_LABEL);
    const ref = `GitHub issue #${githubNumber}${item.url ? ` (${item.url})` : ''}`;
    return {
      branch: workItemBranch(item),
      threadTitle: needsApproval ? `Triage #${githubNumber}: ${item.title}` : `Issue #${githubNumber}: ${item.title}`,
      actions: needsApproval ? [approvalRunAction(ref, githubNumber)] : issueRunActions(ref, { triage: true }),
    };
  }
  if (item.source === 'linear-issue' && typeof meta.identifier === 'string') {
    const ref = `Linear issue ${meta.identifier}${item.url ? ` (${item.url})` : ''}`;
    return {
      branch: workItemBranch(item),
      threadTitle: `${meta.identifier}: ${item.title}`,
      actions: issueRunActions(ref, { context: LINEAR_FETCH_HINT }),
    };
  }
  if (item.source === 'github-pr' && githubNumber !== undefined) {
    const ref = `GitHub pull request #${githubNumber}${item.url ? ` (${item.url})` : ''}`;
    const headBranch = typeof meta.headBranch === 'string' ? ` Expected head branch: ${meta.headBranch}.` : '';
    const checkout = `Check out the PR in this worktree first with \`gh pr checkout ${githubNumber}\`.${headBranch}`;
    return {
      branch: workItemBranch(item),
      threadTitle: `PR #${githubNumber}: ${item.title}`,
      actions: [reviewRunAction(ref, checkout)],
    };
  }
  return;
}

/**
 * Branch + thread title for a card's session. Prefers the run spec (shared
 * with agent runs so the title click and a later run converge on one
 * worktree); the branch grammar itself is shared with the server's autonomous
 * runs (`workItemBranch`), so every card resolves to a session branch.
 */
export function itemSessionSpec(item: WorkItem): { branch: string; threadTitle: string } {
  const spec = itemRunSpec(item);
  if (spec) return { branch: spec.branch, threadTitle: spec.threadTitle };
  return { branch: workItemBranch(item), threadTitle: item.title };
}
