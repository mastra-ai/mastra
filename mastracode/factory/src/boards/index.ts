import type { FactoryRuleBoard } from '../rules/types.js';
import { isReviewBoardPhase, reviewBoard } from './review.js';
import { isWorkBoardPhase, workBoard } from './work.js';

export { BoardDefinitionError, defineBoard } from './define-board.js';
export type { BoardDefinition, BoardPhaseDefinition, BoardTransition } from './define-board.js';
export { reviewBoard } from './review.js';
export type { ReviewBoardPhase } from './review.js';
export { workBoard } from './work.js';
export type { WorkBoardPhase } from './work.js';

const builtInBoards = { work: workBoard, review: reviewBoard } as const;

export function builtInBoard(board: FactoryRuleBoard) {
  return builtInBoards[board];
}

export function allowsBuiltInBoardTransition(board: FactoryRuleBoard, from: string, to: string): boolean {
  if (board === 'work') {
    return isWorkBoardPhase(from) && isWorkBoardPhase(to) && workBoard.allowsTransition(from, to);
  }
  return isReviewBoardPhase(from) && isReviewBoardPhase(to) && reviewBoard.allowsTransition(from, to);
}
