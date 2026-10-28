import { evaluateRuleGroup } from '../rules/rule-group.js';
import type { FactoryCommitDecision } from '../rules/types.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import { cardRuleFacts } from './card-facts.js';
import type { BoardRegistry } from './registry.js';
import { boardForWorkItem } from './semantics.js';

type Card = Pick<WorkItemRow, 'board' | 'externalSource' | 'stages' | 'title' | 'metadata'>;

/**
 * Whether the decision starts the run of a phase that starts on its own for this card
 * (`autoStart`, and `autoStartWhen` when set), so it needs nobody's approval.
 */
export function startsInAutoPhase(boards: BoardRegistry, item: Card, decision: FactoryCommitDecision): boolean {
  if (decision.type === 'transition') {
    return boards.get(decision.board)?.startsAutomatically(decision.stage, cardRuleFacts(item)) === true;
  }
  if (decision.type !== 'invokeSkill' || item.stages.length !== 1) return false;
  const board = boards.get(boardForWorkItem(item));
  const stage = item.stages[0]!;
  return board?.roleForPhase(stage) === decision.role && board.startsAutomatically(stage, cardRuleFacts(item));
}

/** The exit tool of the card's phase when it is approved without a person for this card. */
export function autoApprovedExitTool(boards: BoardRegistry, item: Card): string | undefined {
  if (item.stages.length !== 1) return undefined;
  const phase = boards.get(boardForWorkItem(item))?.phases[item.stages[0]!];
  if (phase?.kind !== 'working' || !phase.exitTool?.autoApprove) return undefined;
  return evaluateRuleGroup(phase.exitTool.autoApproveWhen, cardRuleFacts(item)) ? phase.exitTool.id : undefined;
}
