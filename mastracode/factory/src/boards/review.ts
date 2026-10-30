import { compileBoardDefinition } from './define-board.js';
import { reviewPullRequest, reviewTransitionPolicy } from './pull-request-review.js';

export const reviewBoard = compileBoardDefinition({
  id: 'review',
  name: 'Review',
  initialPhase: 'intake',
  transitionPolicy: reviewTransitionPolicy,
  phases: {
    intake: {
      name: 'Intake',
      kind: 'resting',
      nextPhases: ['review', 'done', 'canceled'],
    },
    review: {
      name: 'Reviewing',
      kind: 'working',
      runner: { context: 'review' },
      nextPhases: ['intake', 'done', 'canceled'],
      onEnter: { pullRequest: reviewPullRequest, gitlabPullRequest: reviewPullRequest },
    },
    done: {
      name: 'Done',
      kind: 'terminal',
      nextPhases: ['review'],
    },
    canceled: {
      name: 'Canceled',
      kind: 'terminal',
      nextPhases: ['review'],
    },
  },
});

export type ReviewBoardPhase = keyof typeof reviewBoard.phases;

export function isReviewBoardPhase(value: string): value is ReviewBoardPhase {
  return value in reviewBoard.phases;
}
