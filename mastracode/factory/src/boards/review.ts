import { compileBoardDefinition } from './define-board.js';
import { reviewPullRequest } from './pull-request-review.js';

/**
 * The retired Review board, served only to projects that still use it (see
 * `readReviewBoardInUse`). New pull requests never land here: intake routes send them to Work.
 */
export const reviewBoard = compileBoardDefinition({
  id: 'review',
  name: 'Review',
  initialPhase: 'intake',
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
