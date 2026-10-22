import { compileStoredBoard } from './compile.js';
import { builtInRunners } from './runners.js';
import { workBoardTemplate } from './templates/work.js';

export { openApprovedChangeRequest, SELF_REVIEW_ROUND_LIMIT, selfReviewRounds } from './runners.js';

export type WorkBoardPhase = 'intake' | 'triage' | 'planning' | 'execute' | 'review' | 'done' | 'canceled';

/** The built-in Work board: the stored template compiled with the built-in runners, so code and stored paths match. */
export const workBoard = compileStoredBoard(workBoardTemplate, builtInRunners);

export function isWorkBoardPhase(value: string): value is WorkBoardPhase {
  return Object.prototype.hasOwnProperty.call(workBoard.phases, value);
}
