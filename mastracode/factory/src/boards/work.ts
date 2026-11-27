import { DEFAULT_BOARD_ID } from './default-board.js';
import { compileBoardDefinition } from './define-board.js';
import type { BoardPhaseDefinition } from './define-board.js';

/**
 * A change request tracked on its own card never attaches to this one, so Review refuses the card and
 * the builder reports no outcome, leaving it in Building: the goal counts that hand-off as done rather
 * than looping on it.
 */
export const OWN_CARD_HAND_OFF =
  'Also done, with no outcome reported and the card left in Building, when the change request was opened but is ' +
  "tracked on its own card and the builder's latest message posts its link and says a person should confirm it " +
  'is reviewed there.';

/**
 * The goal Building pursues. The goal judge sees only this text and the latest messages, so it
 * spells out when the build is done and when it waits for a person.
 */
export const BUILD_OBJECTIVE =
  'Build the plan approved in Planning for this work item. Done when every step of that plan is implemented on ' +
  "the work branch; the plan's verification gates (the tests, typecheck and lint it names, else the narrowest " +
  'relevant ones) were run on the final head and passed; the branch is pushed; and the builder reported its ' +
  'outcome with factory_report_outcome (review after opening the change request, or replan if the plan proved ' +
  "wrong); the builder's latest message names the outcome and the pushed head. Factory moves the card once the " +
  'run ends. ' +
  OWN_CARD_HAND_OFF +
  ' Continue while any of that is missing. Waiting only when the agent asked a person a question it cannot ' +
  'answer from the repository.';

export type WorkBoardPhase = 'intake' | 'planning' | 'execute' | 'pr-review' | 'done' | 'canceled';

export const workBoard = compileBoardDefinition<'work', Record<WorkBoardPhase, BoardPhaseDefinition<WorkBoardPhase>>>({
  id: DEFAULT_BOARD_ID,
  name: 'Work',
  initialPhase: 'intake',
  sourceClosed: { completed: 'done', canceled: 'canceled' },
  phases: {
    intake: {
      name: 'Intake',
      kind: 'resting',
      // Never straight to Building: a plan comes first. Review takes a pull request's own card;
      // Done is where a completed source closes it. New projects' Work has no Triage; projects
      // stored before keep theirs (workSeedWithTriage).
      nextPhases: ['planning', 'pr-review', 'done', 'canceled'],
    },
    planning: {
      name: 'Planning',
      kind: 'working',
      // Planning and Building share one session, so the builder keeps the plan's context.
      runner: { skill: 'factory-plan', context: 'work' },
      nextPhases: ['execute', 'intake', 'done', 'canceled'],
      // The card stays in Planning until submit_plan comes back approved; that reports `advance`,
      // and Factory moves the card to Building once the run ends.
      exitTool: { id: 'submit_plan', autoApprove: false },
      outcomes: [
        { key: 'advance', label: 'Plan approved', to: 'execute' },
        { key: 'rest', label: 'Needs a person before planning can go on', to: 'intake' },
        { key: 'done', label: 'Already done; nothing to build', to: 'done' },
        { key: 'cancel', label: 'Not worth doing', to: 'canceled' },
      ],
    },
    execute: {
      name: 'Building',
      kind: 'working',
      runner: { skill: 'factory-build', context: 'work', goal: { objective: BUILD_OBJECTIVE, maxRuns: 20 } },
      // Review once the builder opened the change request; Planning again when the build shows
      // the plan was wrong.
      nextPhases: ['pr-review', 'planning', 'done', 'canceled'],
      outcomes: [
        { key: 'review', label: 'Change request opened for review', to: 'pr-review' },
        { key: 'replan', label: 'The plan proved wrong', to: 'planning' },
        { key: 'done', label: 'Nothing left to change', to: 'done' },
        { key: 'cancel', label: 'Not worth doing', to: 'canceled' },
      ],
    },
    'pr-review': {
      // Keyed `pr-review`: projects stored before Work dropped its self-review phase hold a
      // `review` phase for it, and the retired Review board's cards read as `pr-review`.
      name: 'Review',
      // A card's pull request is reviewed here by the independent reviewer, in its own
      // review seat on the pull request's branch. Work has no self-review phase; a board that
      // wants one adds a review-context phase granting only factory_record_review_verdict.
      kind: 'working',
      runner: { skill: 'factory-review', context: 'review' },
      tools: ['factory_record_review_verdict', 'factory_review_source'],
      // Merged, closed, or set aside in Intake. An issue card can go back to its builder for a
      // fix; a pull request's own card never reaches the builder's lanes (workPullRequestCardRejection).
      nextPhases: ['intake', 'planning', 'execute', 'done', 'canceled'],
    },
    done: {
      name: 'Done',
      kind: 'terminal',
      // A review request on a finished pull request reopens its review.
      nextPhases: ['pr-review'],
    },
    canceled: {
      name: 'Canceled',
      kind: 'terminal',
      // Revived into Intake; a pull request closed without merging and then reopened goes back to Review.
      nextPhases: ['intake', 'pr-review'],
    },
  },
});
