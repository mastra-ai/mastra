import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import type { BoardPhaseKind, BoardToolResultRuleHandler } from './define-board.js';
import type { BoardRegistry } from './registry.js';

export interface PhaseSemantics {
  readonly kind: BoardPhaseKind;
  /** Seat that carries a working phase; absent for resting and terminal phases. */
  readonly role?: string;
}

/**
 * Board that owns a work item. Rows created before boards were persisted carry no `board`;
 * they belong to Review when they track a pull request and to Work otherwise, matching the
 * legacy assignment the transition service performs on their next move.
 */
export function boardForWorkItem(item: Pick<WorkItemRow, 'board' | 'externalSource'>): string {
  return item.board ?? (item.externalSource?.type === 'pull-request' ? 'review' : 'work');
}

/**
 * What the installed board says `phase` means. Returns undefined when the board is not
 * installed or does not declare the phase; callers must fail closed on undefined rather
 * than guess from the phase name.
 */
export function resolvePhaseSemantics(
  boards: BoardRegistry,
  boardId: string,
  phase: string,
): PhaseSemantics | undefined {
  const board = boards.get(boardId);
  const kind = board?.phaseKind(phase);
  if (!board || !kind) return undefined;
  const role = board.roleForPhase(phase);
  return role === undefined ? { kind } : { kind, role };
}

/**
 * Tool-result rule the installed board declares for `toolName`. Undefined when the board is
 * not installed or declares no rule for the tool; callers must run nothing in that case.
 */
export function resolveBoardToolRule(
  boards: BoardRegistry,
  boardId: string,
  toolName: string,
): BoardToolResultRuleHandler | undefined {
  return boards.get(boardId)?.tools[toolName]?.onResult;
}

/**
 * Whether a persisted card has finished, judged by the board it sits on: the installed
 * board's phase kind first, then the built-in Work and Review names for rows whose board is
 * not installed. Unknown boards or phases are never terminal, so a card is only ever
 * released from ownership on the board's own say-so.
 */
export function isTerminalWorkItem(
  boards: BoardRegistry,
  item: Pick<WorkItemRow, 'board' | 'externalSource' | 'stages'>,
): boolean {
  const semantics = workItemPhaseSemantics(boards, item);
  if (semantics) return semantics.kind === 'terminal';
  const board = boardForWorkItem(item);
  if (board !== 'work' && board !== 'review') return false;
  const stage = item.stages.length === 1 ? item.stages[0] : undefined;
  return stage === 'done' || stage === 'canceled';
}

/** Semantics of the single stage a work item currently occupies; undefined for multi-stage rows. */
export function workItemPhaseSemantics(
  boards: BoardRegistry,
  item: Pick<WorkItemRow, 'board' | 'externalSource' | 'stages'>,
): PhaseSemantics | undefined {
  const stage = item.stages.length === 1 ? item.stages[0] : undefined;
  if (!stage) return undefined;
  return resolvePhaseSemantics(boards, boardForWorkItem(item), stage);
}
