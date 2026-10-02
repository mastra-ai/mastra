import type { InstalledBoardInfo } from '../../../api/types';
import { itemStageLabel } from './boardStages';
import type { CardMove } from './cardPrimaryAction';
import type { FactoryDecisionSummary } from './services/decisions';
import type { WorkItem } from './services/workItems';

export function primaryCardMove(moves: CardMove[], columnStage: string, sessions: WorkItem['sessions']) {
  const columnMove = moves.find(move => move.stage === columnStage);
  if (columnMove) return columnMove;
  const unusedMove = moves.find(move => !(move.role in sessions));
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
