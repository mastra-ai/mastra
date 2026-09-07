export { BoardDefinitionError, defineBoard } from './define-board.js';
export type { BoardDefinition, BoardPhaseDefinition, BoardTransition } from './define-board.js';
export type {
  BoardTransitionPolicy,
  BoardTransitionPolicyContext,
  BoardTransitionPolicyResult,
} from './transition-policy.js';
export { createBoardRegistry, defaultBoards } from './registry.js';
export type { BoardRegistry, InstalledBoard } from './registry.js';
import { isReviewBoardPhase, reviewBoard } from './review.js';
import { isWorkBoardPhase, workBoard } from './work.js';

export { reviewBoard } from './review.js';
export type { ReviewBoardPhase } from './review.js';
export { workBoard } from './work.js';
export type { WorkBoardPhase } from './work.js';

const builtInBoards = { work: workBoard, review: reviewBoard } as const;

export function builtInBoard(board: 'work' | 'review') {
  return builtInBoards[board];
}

export function allowsBuiltInBoardTransition(board: 'work' | 'review', from: string, to: string): boolean {
  if (board === 'work') {
    return isWorkBoardPhase(from) && isWorkBoardPhase(to) && workBoard.allowsTransition(from, to);
  }
  return isReviewBoardPhase(from) && isReviewBoardPhase(to) && reviewBoard.allowsTransition(from, to);
}
