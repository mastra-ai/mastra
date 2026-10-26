export { BoardDefinitionError, defineBoard } from './define-board.js';
export type {
  BoardDefinition,
  BoardEventIntegration,
  BoardEventRules,
  BoardPhaseDefinition,
  BoardPhaseKind,
  BoardSourceClosed,
  BoardToolResultRuleHandler,
  BoardToolRule,
  BoardToolRules,
  BoardTransition,
} from './define-board.js';
export {
  boardEventHandlers,
  boardForWorkItem,
  eventBoardId,
  isTerminalWorkItem,
  phaseForSeat,
  resolveBoardClosure,
  resolveBoardToolRule,
  rulePhaseContext,
  rulePhaseField,
  resolvePhaseSemantics,
  withBoardClosure,
  workItemPhaseSemantics,
} from './semantics.js';
export type { PhaseSemantics } from './semantics.js';
export type {
  BoardTransitionPolicy,
  BoardTransitionPolicyContext,
  BoardTransitionPolicyResult,
} from './transition-policy.js';
export { createBoardRegistry, defaultBoards } from './registry.js';
export type { BoardRegistry, InstalledBoard } from './registry.js';
import { isWorkBoardPhase, workBoard } from './work.js';

export { workBoard } from './work.js';
export type { WorkBoardPhase } from './work.js';

export function builtInBoard(_board: 'work') {
  return workBoard;
}

export function allowsBuiltInBoardTransition(_board: 'work', from: string, to: string): boolean {
  return isWorkBoardPhase(from) && isWorkBoardPhase(to) && workBoard.allowsTransition(from, to);
}

export { createRunnerRegistry } from './config.js';
export { builtInRunners } from './runners.js';
export type { BoardRunner, BoardRunnerRegistry } from './runners.js';
export { defaultProjectBoardConfig, workBoardTemplate } from './templates/work.js';
export type { ProjectBoardConfigInput, StoredBoardInput } from '../storage/domains/boards/validation.js';
