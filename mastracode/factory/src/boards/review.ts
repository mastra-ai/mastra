import { compileBoardDefinition } from './define-board.js';
import { reviewPullRequest } from './pull-request-review.js';

/**
 * The retired Review board, served only to projects that still use it (see
 * `readReviewBoardInUse`). The default intake routes send new pull requests to Work; one lands
 * here only through a route of the project's own that targets `review`.
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
