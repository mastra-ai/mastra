import { compileBoardDefinition } from './define-board.js';

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
      description: 'Pull requests wait here until a review starts.',
      kind: 'resting',
      nextPhases: ['review', 'done', 'canceled'],
    },
    review: {
      name: 'Reviewing',
      description: 'An agent reviews the pull request and records a verdict.',
      kind: 'working',
      runner: { context: 'review', skill: 'factory-review' },
      tools: ['factory_record_review_verdict', 'factory_review_source'],
      nextPhases: ['intake', 'done', 'canceled'],
    },
    done: {
      name: 'Done',
      description: 'The review finished, or the pull request merged.',
      kind: 'terminal',
      nextPhases: ['review'],
    },
    canceled: {
      name: 'Canceled',
      description: 'The pull request closed without merging, or the review was set aside.',
      kind: 'terminal',
      nextPhases: ['review'],
    },
  },
});
