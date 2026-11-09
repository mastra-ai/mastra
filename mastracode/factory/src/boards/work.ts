import { compileBoardDefinition } from './define-board.js';
import type { BoardPhaseDefinition } from './define-board.js';

/**
 * The goal Building pursues. The goal judge sees only this text and the latest messages, so it
 * spells out when the build is done and when it waits for a person.
 */
export const BUILD_OBJECTIVE =
  'Build the plan approved in Planning for this work item. Done when every step of that plan is implemented on ' +
  "the work branch; the plan's verification gates (the tests, typecheck and lint it names, else the narrowest " +
  'relevant ones) were run on the final head and passed; the branch is pushed; and the card was moved on with ' +
  "factory_transition_work_item out of Building (to Review or PR review as the builder's hand-off says, or back to " +
  "Planning if the plan proved wrong); the builder's latest message names the move and the pushed head. Continue " +
  'while any of that is missing. Waiting only when the agent asked a person a question it cannot answer from the ' +
  'repository.';

export type WorkBoardPhase =
  | 'intake'
  | 'triage'
  | 'planning'
  | 'execute'
  | 'review'
  | 'pr-review'
  | 'done'
  | 'canceled';

/** A pull request's own card on Work is only reviewed: it never enters these phases, whoever moves it. */
const NON_PULL_REQUEST_PHASES: ReadonlySet<string> = new Set(['triage', 'planning', 'execute', 'review']);

/**
 * Why a move breaks the shape of a card on Work, or undefined when it does not: a pull request's
 * own card is only reviewed, and PR review holds only cards that carry a pull request (their own,
 * or one attached to their issue). `nextPhases` cannot say this: Intake leads to both Triage and
 * PR review, and which one fits depends on the card.
 */
export function workPullRequestCardRejection(
  card: { readonly standalonePullRequest: boolean; readonly hasPullRequest: boolean },
  toStage: string,
): string | undefined {
  if (!card.hasPullRequest && toStage === 'pr-review')
    return 'PR review holds only cards with a pull request; this work item goes to Review after Building.';
  if (!card.standalonePullRequest || !NON_PULL_REQUEST_PHASES.has(toStage)) return undefined;
  return `A pull request card is reviewed on the Work board; it cannot enter ${toStage}. Move it to pr-review, done, or canceled.`;
}

export const workBoard = compileBoardDefinition<'work', Record<WorkBoardPhase, BoardPhaseDefinition<WorkBoardPhase>>>({
  id: 'work',
  name: 'Work',
  initialPhase: 'intake',
  sourceClosed: { completed: 'done', canceled: 'canceled' },
  phases: {
    intake: {
      name: 'Intake',
      kind: 'resting',
      // Never straight to Building or Review: a plan comes first, and Review is self-review of a
      // build. PR review takes a pull request's own card; Done is where a completed source closes it.
      nextPhases: ['triage', 'planning', 'pr-review', 'done', 'canceled'],
    },
    triage: {
      name: 'Triage',
      kind: 'working',
      runner: { skill: 'factory-triage', context: 'triage' },
      // A confirmed bug goes to Planning; any other open issue waits in Intake for a person.
      nextPhases: ['intake', 'planning', 'done', 'canceled'],
    },
    planning: {
      name: 'Planning',
      kind: 'working',
      // Planning and Building share one session, so the builder keeps the plan's context.
      runner: { skill: 'factory-plan', context: 'work' },
      nextPhases: ['execute', 'triage', 'intake', 'done', 'canceled'],
      // The card stays in Planning until submit_plan comes back approved; then factory-plan moves it.
      exitTool: { id: 'submit_plan', autoApprove: false },
    },
    execute: {
      name: 'Building',
      kind: 'working',
      runner: { skill: 'factory-build', context: 'work', goal: { objective: BUILD_OBJECTIVE, maxRuns: 20 } },
      // Review with self-review on; PR review once the builder opened the change request with it
      // off; Planning again when the build shows the plan was wrong.
      nextPhases: ['review', 'pr-review', 'planning', 'done', 'canceled'],
    },
    review: {
      name: 'Review',
      // An independent reviewer tests the builder's pushed branch in its own review seat
      // (self-review); on approve it opens the change request and moves the card to PR review.
      kind: 'working',
      runner: { skill: 'factory-self-review', context: 'review' },
      // A card re-entering Review with its change request already open waits for a person.
      autoStart: true,
      autoStartWhen: { operator: 'AND', conditions: [{ field: 'item.pullRequest', operator: 'not_exists' }] },
      tools: ['factory_record_review_verdict'],
      // Self-review sends the card back to Building, or parks it in Intake at its round limit.
      // A maintainer's review request takes its open pull request to PR review.
      nextPhases: ['execute', 'intake', 'pr-review', 'done', 'canceled'],
    },
    'pr-review': {
      name: 'PR review',
      // A card's pull request is reviewed here by the independent reviewer, in its own
      // review seat on the pull request's branch. Kept apart from Review, the builder's
      // self-review of its own branch.
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

export function isWorkBoardPhase(value: string): value is WorkBoardPhase {
  return Object.prototype.hasOwnProperty.call(workBoard.phases, value);
}
