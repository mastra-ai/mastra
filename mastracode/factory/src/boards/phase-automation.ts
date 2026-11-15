import { evaluateRuleGroup } from '../rules/rule-group.js';
import type { FactoryCommitDecision } from '../rules/types.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { cardRuleFacts } from './card-facts.js';
import type { BoardRegistry } from './registry.js';
import { boardForWorkItem } from './semantics.js';

/** Card metadata recording the last phase an exit tool finished: `{ phase, tool, at }`. */
export const PHASE_EXIT_METADATA_KEY = 'phaseExit';

/**
 * Whether the exit tool of `stage` succeeded (for `submit_plan`, with an approved plan) since the
 * card last entered it. Until then the card stays in the phase, except when a person moves it.
 */
export function exitToolSucceeded(
  item: Pick<Card, 'metadata' | 'stageHistory'>,
  stage: string,
  toolId: string,
): boolean {
  const exit: unknown = item.metadata?.[PHASE_EXIT_METADATA_KEY];
  if (!exit || typeof exit !== 'object' || Array.isArray(exit)) return false;
  const { phase, tool, at } = exit as Record<string, unknown>;
  if (phase !== stage || tool !== toolId || typeof at !== 'string') return false;
  const entered = item.stageHistory.findLast(entry => entry.stage === stage && entry.exitedAt === undefined);
  return entered !== undefined && Date.parse(at) >= Date.parse(entered.enteredAt);
}

type PhaseCard = Pick<Card, 'board' | 'externalSource' | 'stages' | 'title' | 'metadata' | 'workItem'>;

/**
 * Whether the decision starts the run of a phase that starts on its own for this card
 * (`autoStart`, and `autoStartWhen` when set), so it needs nobody's approval.
 */
export function startsInAutoPhase(boards: BoardRegistry, item: PhaseCard, decision: FactoryCommitDecision): boolean {
  if (decision.type === 'transition') {
    return boards.get(decision.board)?.startsAutomatically(decision.stage, cardRuleFacts(item)) === true;
  }
  if (decision.type !== 'invokeSkill' || item.stages.length !== 1) return false;
  const boardKey = boardForWorkItem(item);
  const board = boards.get(boardKey);
  const stage = item.stages[0]!;
  if (!board) return false;
  return board.roleForPhase(stage) === decision.role && board.startsAutomatically(stage, cardRuleFacts(item));
}

/** The exit tool of the card's phase when it is approved without a person for this card. */
export function autoApprovedExitTool(boards: BoardRegistry, item: PhaseCard): string | undefined {
  if (item.stages.length !== 1) return undefined;
  const phase = boards.get(boardForWorkItem(item))?.phases[item.stages[0]!];
  if (phase?.kind !== 'working' || !phase.exitTool?.autoApprove) return undefined;
  return evaluateRuleGroup(phase.exitTool.autoApproveWhen, cardRuleFacts(item)) ? phase.exitTool.id : undefined;
}
