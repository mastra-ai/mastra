import type { FactoryRuleItemContext, FactoryStageRuleContext } from '../rules/types.js';
import { workItemNumber } from '../work-item-branch.js';
import { defineBoard } from './define-board.js';

function sourceRef(item: FactoryRuleItemContext): string {
  const link = item.url ? ` (${item.url})` : '';
  const number = workItemNumber(item);
  if (number === undefined) return item.url ? `GitHub pull request${link}` : item.title;
  return `GitHub pull request #${number}${link}`;
}

/** The review agent lands in a bare worktree, so it needs the PR checked out and the branch it should expect. */
function checkoutHint(item: FactoryRuleItemContext): string {
  const number = workItemNumber(item);
  const checkout =
    number === undefined
      ? 'Check out the PR in this worktree first.'
      : `Check out the PR in this worktree first with \`gh pr checkout ${number}\`.`;
  // Backticked because a branch name is written by whoever opened the PR: it stays a quoted value, not a sentence.
  const headBranch =
    typeof item.metadata?.headBranch === 'string' ? ` Expected head branch: \`${item.metadata.headBranch}\`.` : '';
  return `${checkout}${headBranch}`;
}

function reviewPullRequest(context: FactoryStageRuleContext) {
  // Only a Review-to-Review re-entry can supersede an active pass. A card
  // returning from Done has no live review to cancel; aborting its bound session
  // would instead cancel the fresh re-review kickoff.
  const supersedes = context.fromStage === 'review';
  // The re-review skill only applies when a prior review pass actually completed
  // (the card is returning from `done`). A cancelled first-time review that
  // re-enters Review from `review` itself still has no prior pass to reconcile —
  // it gets the regular factory-review skill.
  const priorReviewCompleted = context.fromStage === 'done';
  const skillName = priorReviewCompleted ? 'factory-rereview' : 'factory-review';
  return {
    type: 'invokeSkill',
    idempotencyKey: `${context.ingress.id}:${skillName}`,
    role: 'review',
    skillName,
    arguments: `${sourceRef(context.item)}\n\n${checkoutHint(context.item)}`,
    ...(supersedes ? { cancelInFlight: true } : {}),
  } as const;
}

function reviewPullRequestOnArrival(context: FactoryStageRuleContext) {
  if (context.cause !== 'linked_item_materialized') return;
  if (context.item.metadata?.autoStartCandidate !== true) return;
  return reviewPullRequest(context);
}

export const reviewBoard = defineBoard({
  id: 'review',
  title: 'Review',
  initialPhase: 'intake',
  phases: {
    intake: {
      title: 'Intake',
      outcomes: {
        reviewRequested: 'review',
        merged: 'done',
        closed: 'canceled',
      },
      onEnter: { pullRequest: reviewPullRequestOnArrival },
    },
    review: {
      title: 'Reviewing',
      outcomes: {
        parked: 'intake',
        merged: 'done',
        closed: 'canceled',
      },
      onEnter: { pullRequest: reviewPullRequest },
    },
    done: {
      title: 'Done',
      outcomes: { updated: 'review' },
    },
    canceled: {
      title: 'Canceled',
      outcomes: { reviewRequested: 'review' },
    },
  },
});

export type ReviewBoardPhase = keyof typeof reviewBoard.phases;

export function isReviewBoardPhase(value: string): value is ReviewBoardPhase {
  return value in reviewBoard.phases;
}
