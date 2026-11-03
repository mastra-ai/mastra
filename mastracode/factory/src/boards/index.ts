export { BoardDefinitionError, DEFAULT_PHASE_CONTEXT, defineBoard, FACTORY_AGENT_ID } from './define-board.js';
export { cardRuleFacts } from './card-facts.js';
export type {
  BoardDefinition,
  BoardEventIntegration,
  BoardEventRules,
  BoardPhase,
  BoardPhaseDefinition,
  BoardPhaseExitTool,
  BoardPhaseKind,
  BoardPhaseRunner,
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
  hasPullRequest,
  isPullRequestCard,
  isTerminalWorkItem,
  newestOpenPullRequestNumber,
  PULL_REQUEST_REVIEW_PHASE,
  pullRequestSourceNumber,
  pullRequestSources,
  resolveBoardClosure,
  reviewedChangeRequest,
  reviewedPullRequest,
  sourceExternalId,
  reviewsPullRequest,
  resolveBoardToolRule,
  rulePhaseContext,
  rulePhaseField,
  resolvePhaseSemantics,
  withBoardClosure,
  workItemPhaseSemantics,
} from './semantics.js';
export type { PhaseSemantics, ReviewedChangeRequest } from './semantics.js';
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

export function allowsBuiltInBoardTransition(_board: 'work', from: string, to: string): boolean {
  return isWorkBoardPhase(from) && isWorkBoardPhase(to) && workBoard.allowsTransition(from, to);
}
