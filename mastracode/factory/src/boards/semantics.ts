import type { FactoryRuleBoardClosure, FactoryRulePhaseContext } from '../rules/types.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import type {
  BoardEventIntegration,
  BoardEventRules,
  BoardPhaseKind,
  BoardToolResultRuleHandler,
} from './define-board.js';
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
 * Integration event handlers the installed board declares for cards on it, or undefined when the
 * card is unbound, the board is not installed, or it declares none for this integration. Within the
 * map, `null` means the board switched that event off for its cards.
 */
export function boardEventHandlers<I extends BoardEventIntegration>(
  boards: Pick<BoardRegistry, 'get'>,
  boardId: string | undefined,
  integration: I,
): BoardEventRules[I] | undefined {
  return boardId === undefined ? undefined : boards.get(boardId)?.events[integration];
}

/**
 * Board whose event handlers answer an integration evaluation: the bound card's board, except on
 * the evaluation that files a pull request's own Review card, which is about a card that does
 * not exist yet.
 */
export function eventBoardId(context: {
  readonly item?: unknown;
  readonly board?: string;
  readonly pullRequestIntake?: boolean;
}): string | undefined {
  return context.item && !context.pullRequestIntake ? context.board : undefined;
}

/** What a card's single current phase means on its installed board, for integration rule contexts. */
export function rulePhaseContext(
  boards: Pick<BoardRegistry, 'get'>,
  item: Pick<WorkItemRow, 'board' | 'externalSource' | 'stages'>,
): FactoryRulePhaseContext | undefined {
  const stage = item.stages.length === 1 ? item.stages[0] : undefined;
  if (!stage) return undefined;
  const board = boards.get(boardForWorkItem(item));
  const kind = board?.phaseKind(stage);
  if (!board || !kind) return undefined;
  const role = board.roleForPhase(stage);
  const outcomes = Object.freeze(Object.keys(board.phases[stage]?.outcomes ?? {}));
  return Object.freeze({ id: stage, kind, ...(role === undefined ? {} : { role }), outcomes });
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

/**
 * Where source-closed rules send a persisted card: the `sourceClosed` mapping its installed
 * board declares, plus whether the card already sits in a terminal phase. Undefined when the
 * board is not installed or declares no mapping, so closing the source leaves the card alone.
 */
export function resolveBoardClosure(
  boards: BoardRegistry,
  item: Pick<WorkItemRow, 'board' | 'externalSource' | 'stages'>,
): FactoryRuleBoardClosure | undefined {
  const board = boards.get(boardForWorkItem(item));
  if (!board?.sourceClosed) return undefined;
  const { completed, canceled } = board.sourceClosed;
  return {
    boardTitle: board.title,
    completed: { phase: completed, title: board.phases[completed]!.title },
    canceled: { phase: canceled, title: board.phases[canceled]!.title },
    itemTerminal: item.stages.some(stage => board.isTerminal(stage)),
  };
}

/** Rule-context fragment carrying the card's `boardClosure`, empty when the board declares none. */
export function withBoardClosure(
  boards: BoardRegistry,
  item: Pick<WorkItemRow, 'board' | 'externalSource' | 'stages'>,
): { boardClosure?: FactoryRuleBoardClosure } {
  const boardClosure = resolveBoardClosure(boards, item);
  return boardClosure ? { boardClosure } : {};
}

/** `{ phase }` for spreading into an integration rule context, or `{}` when the phase is unknown. */
export function rulePhaseField(
  boards: Pick<BoardRegistry, 'get'>,
  item: Pick<WorkItemRow, 'board' | 'externalSource' | 'stages'>,
): { readonly phase?: FactoryRulePhaseContext } {
  const phase = rulePhaseContext(boards, item);
  return phase ? { phase } : {};
}
