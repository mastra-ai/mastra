import type { FactoryRole } from '@mastra/factory/rules/types';
import { workItemBranch } from '@mastra/factory/work-item-branch';
import type { FactoryRunInvocation, FactoryRunPhase } from '../../../hooks/useStartFactoryRun';
import { NEEDS_APPROVAL_LABEL, githubNumberForItem, hasLabel, metadataLabels } from './boardItems';
import type { WorkItem } from './services/workItems';

export const RUN_PHASE_LABELS: Record<FactoryRunPhase, string> = {
  workspace: 'preparing workspace…',
  kickoff: 'starting agent…',
  opening: 'opening thread…',
};

// One startable run; its lane is the role's stage (`FACTORY_ROLE_STAGES`), and
// all of an item's runs share one branch/worktree, so a later run is a follow-up.
export interface RunAction {
  label: 'Investigate' | 'Build' | 'Prepare approval' | 'Review';
  /** Session slot the run fills on the card, e.g. `plan` or `work`. */
  role: FactoryRole;
  invocation: FactoryRunInvocation;
  /** The run's outcome is a maintainer decision, so hands-off has nothing to remove. */
  awaitsHumanDecision?: true;
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
  return [
    {
      label: 'Investigate',
      role: extra?.triage ? 'triage' : 'plan',
      invocation: {
        type: 'skill',
        skillName: 'factory-triage',
        arguments: `${ref}${context}`,
      },
    },
    {
      label: 'Build',
      role: 'work',
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
    awaitsHumanDecision: true,
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
    invocation: {
      type: 'skill',
      skillName: 'factory-review',
      arguments: `${ref}\n\n${checkout}`,
    },
  };
}

export const LINEAR_FETCH_HINT = `Start by fetching the issue's full details (description and comments) with the linear_get_issue tool.`;

/**
 * The `needs approval` label only holds a card at rest. Once a person accepts
 * it — or it sits in a working lane, which only a person could have put it in
 * before acceptance was recorded — the label is stale until the source
 * catches up, and the card offers its ordinary runs again.
 */
function approvalPending(item: Pick<WorkItem, 'metadata' | 'stages' | 'acceptedAt'>): boolean {
  return (
    hasLabel(metadataLabels(item.metadata), NEEDS_APPROVAL_LABEL) &&
    item.acceptedAt === null &&
    item.stages.every(stage => stage === 'intake' || stage === 'triage')
  );
}

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
    const needsApproval = approvalPending(item);
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
