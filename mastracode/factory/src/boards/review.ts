import type { FactoryStageRuleContext } from '../rules/types.js';
import { defineBoard } from './define-board.js';

function reviewPullRequest(context: FactoryStageRuleContext) {
  const supersedes = context.fromStage === 'review';
  const priorReviewCompleted = context.fromStage === 'done';
  const skillName = priorReviewCompleted ? 'factory-rereview' : 'factory-review';
  return {
    type: 'invokeSkill',
    idempotencyKey: `${context.ingress.id}:${skillName}`,
    role: 'review',
    skillName,
    arguments: context.item.url ? `GitHub pull request (${context.item.url})` : context.item.title,
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
    canceled: { title: 'Canceled' },
  },
});

export type ReviewBoardPhase = keyof typeof reviewBoard.phases;

export function isReviewBoardPhase(value: string): value is ReviewBoardPhase {
  return value in reviewBoard.phases;
}
