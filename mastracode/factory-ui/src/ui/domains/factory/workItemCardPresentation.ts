import type { InstalledBoardInfo } from '../../../api/types';
import { itemStageLabel } from './boardStages';
import type { CardMove } from './cardPrimaryAction';
import type { FactoryDecisionSummary } from './services/decisions';
import type { WorkItem } from './services/workItems';

// The lane's own move first: clicking the button of the column a card sits in re-runs that lane.
// Then the first lane the card has not had a run in, so a card never leads with a run it has already had.
// Phases can share a session (Planning and Building both run in `work`), so a lane the card has never
// entered still counts as unused even when its session exists.
export function primaryCardMove(
  moves: CardMove[],
  columnStage: string,
  item: Pick<WorkItem, 'sessions'> & { stageHistory?: readonly { stage: string }[] },
) {
  const columnMove = moves.find(move => move.stage === columnStage);
  if (columnMove) return columnMove;
  const visited = new Set((item.stageHistory ?? []).map(entry => entry.stage));
  const unusedMove = moves.find(move => !(move.role in item.sessions) || !visited.has(move.stage));
  return unusedMove ?? moves[0];
}

export function nextBoardPhase(definition: InstalledBoardInfo | undefined, columnStage: string) {
  const currentPhase = definition?.phases.find(phase => phase.id === columnStage);
  const nextPhaseId = currentPhase?.transitions?.[0]?.to;
  const nextPhase = definition?.phases.find(phase => phase.id === nextPhaseId);
  if (!nextPhase) return undefined;
  return { id: nextPhase.id, label: nextPhase.title };
}

export function proposedCardRun(
  proposal: FactoryDecisionSummary | undefined,
  custom: boolean,
  definition: InstalledBoardInfo | undefined,
  moves: CardMove[],
  primaryMove: CardMove | undefined,
) {
  if (!proposal) return undefined;
  if (custom) {
    const phase = definition?.phases.find(phase => phase.role === proposal.role);
    // A proposal for a role this board never declares is a leftover from another board.
    if (!phase) return undefined;
    return { decisionId: proposal.id, label: phase.title };
  }
  const proposedMove = moves.find(move => move.role === proposal.role);
  const label = proposedMove?.label ?? primaryMove?.label ?? 'Start run';
  return { decisionId: proposal.id, label };
}

export function movingCardStatus(
  stage: string | undefined,
  definition: InstalledBoardInfo | undefined,
  item: WorkItem,
) {
  if (stage === undefined) return undefined;
  const phase = definition?.phases.find(phase => phase.id === stage);
  return { stage, label: phase?.title ?? itemStageLabel(item, stage) };
}
