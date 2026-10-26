import type { FACTORY_RULE_STAGES, FactoryRuleBoard, FactoryRuleStage } from '@mastra/factory/rules/types';

import type { WorkItem } from './services/workItems';
import { BOARD_STAGES, stageLabel, stageOrder } from './stages';
import type { BoardStage, BoardStageId } from './stages';

export type BoardKind = FactoryRuleBoard;

const REVIEW_BOARD_STAGE_VISIBILITY: Partial<Record<FactoryRuleStage, boolean>> = {
  intake: true,
  triage: false,
  planning: false,
  execute: false,
  review: true,
  done: true,
  canceled: true,
} satisfies Record<(typeof FACTORY_RULE_STAGES)[number], boolean>;

const REVIEW_BOARD_STAGES: ReadonlyArray<BoardStage> = BOARD_STAGES.flatMap(stage => {
  if (!REVIEW_BOARD_STAGE_VISIBILITY[stage.id]) return [];
  return [stage.id === 'review' ? { ...stage, label: 'Reviewing' } : stage];
});

export function boardStages(kind: BoardKind): ReadonlyArray<BoardStage> {
  return kind === 'review' ? REVIEW_BOARD_STAGES : BOARD_STAGES;
}

export function belongsToBoard(item: WorkItem, kind: BoardKind): boolean {
  return itemBoard(item) === kind;
}

/**
 * Cards the board leaves out because another card carries their work: a pull request card folded
 * into the card that opened it, and a GitLab merge request Factory opened, filed as that card's child.
 */
export function isFoldedCard(item: Pick<WorkItem, 'source' | 'parentWorkItemId' | 'metadata'>): boolean {
  if (typeof item.metadata?.foldedInto === 'string') return true;
  return (item.source === 'github-pr' || item.source === 'gitlab-pr') && item.parentWorkItemId != null;
}

export function itemAppearsInStage(
  item: WorkItem,
  stage: BoardStageId,
  stages: ReadonlyArray<{ id: BoardStageId }>,
): boolean {
  if (item.stages.includes(stage)) return true;
  return stage === 'intake' && !stages.some(candidate => item.stages.includes(candidate.id));
}

export function boardLoadingStages({
  stages,
  itemsPending,
  intakePending,
  triagePending,
}: {
  stages: ReadonlyArray<BoardStage>;
  itemsPending: boolean;
  intakePending: boolean;
  triagePending: boolean;
}): ReadonlySet<BoardStageId> {
  const loading = new Set<BoardStageId>();
  if (itemsPending) {
    for (const stage of stages) loading.add(stage.id);
  }
  if (intakePending) loading.add('intake');
  if (triagePending) loading.add('triage');
  return loading;
}

/** The Review board was folded into Work; cards still recorded on it read as Work. */
export function itemBoard(item: Pick<WorkItem, 'board'>): string {
  return item.board == null || item.board === 'review' ? 'work' : item.board;
}

export function itemStageOptions(item: WorkItem): ReadonlyArray<BoardStage> {
  return boardStages(itemBoard(item));
}

export function itemStageLabel(item: WorkItem, stage: string): string {
  return itemStageOptions(item).find(candidate => candidate.id === stage)?.label ?? stageLabel(stage);
}

/** Furthest stage the item currently sits in; items with no known stage read as Intake, like the board columns. */
export function currentItemStageLabel(item: WorkItem): string {
  const options = itemStageOptions(item);
  // Stages off this item's board sort after every column, so keeping them would beat the real one
  const onBoard = item.stages.filter(stage => options.some(candidate => candidate.id === stage));
  const furthest = onBoard.sort((a, b) => stageOrder(b) - stageOrder(a)).at(0);
  return itemStageLabel(item, furthest ?? 'intake');
}
