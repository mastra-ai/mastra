import type { FactoryRuleBoard, FactoryRuleStage } from '@mastra/factory/rules/types';

import type { WorkItem } from './services/workItems';
import { BOARD_STAGES, stageLabel, stageOrder } from './stages';
import type { BoardStage, BoardStageId } from './stages';

export type BoardKind = FactoryRuleBoard;

const REVIEW_BOARD_STAGE_VISIBILITY = {
  intake: true,
  triage: false,
  planning: false,
  execute: false,
  review: true,
  done: true,
  canceled: true,
} satisfies Record<FactoryRuleStage, boolean>;

const REVIEW_BOARD_STAGES: ReadonlyArray<BoardStage> = BOARD_STAGES.flatMap(stage => {
  if (!REVIEW_BOARD_STAGE_VISIBILITY[stage.id]) return [];
  return [stage.id === 'review' ? { ...stage, label: 'Reviewing' } : stage];
});

export function boardStages(kind: BoardKind): ReadonlyArray<BoardStage> {
  return kind === 'review' ? REVIEW_BOARD_STAGES : BOARD_STAGES;
}

export function belongsToBoard(item: WorkItem, kind: BoardKind): boolean {
  return kind === 'review' ? item.source === 'github-pr' : item.source !== 'github-pr';
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

export function itemBoard(item: WorkItem): 'work' | 'review' {
  return item.source === 'github-pr' ? 'review' : 'work';
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
