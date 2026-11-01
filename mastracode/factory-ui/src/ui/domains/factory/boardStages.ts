import type { FACTORY_RULE_STAGES, FactoryRuleBoard, FactoryRuleStage } from '@mastra/factory/rules/types';

import { isPullRequestSource } from './services/workItems';
import type { WorkItem, WorkItemSource } from './services/workItems';
import { BOARD_STAGES, stageLabel, stageOrder } from './stages';
import type { BoardStage, BoardStageId } from './stages';

export type BoardKind = FactoryRuleBoard;

const REVIEW_BOARD_STAGE_VISIBILITY: Partial<Record<FactoryRuleStage, boolean>> = {
  intake: true,
  triage: false,
  planning: false,
  execute: false,
  review: true,
  'pr-review': false,
  done: true,
  canceled: true,
} satisfies Record<(typeof FACTORY_RULE_STAGES)[number], boolean>;

/** A pull request's card on Work moves only through the lanes that review it; Review is the builder's self-review. */
const PULL_REQUEST_LANES: ReadonlySet<FactoryRuleStage> = new Set(['intake', 'pr-review', 'done', 'canceled']);
const PULL_REQUEST_STAGES: ReadonlyArray<BoardStage> = BOARD_STAGES.filter(stage => PULL_REQUEST_LANES.has(stage.id));
/** Every other card on Work moves through every lane but PR review. */
const WORK_ITEM_STAGES: ReadonlyArray<BoardStage> = BOARD_STAGES.filter(stage => stage.id !== 'pr-review');

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

export function itemBoard(item: WorkItem): string {
  return item.board ?? (item.source === 'github-pr' || item.source === 'gitlab-pr' ? 'review' : 'work');
}

export function itemStageOptions(item: WorkItem): ReadonlyArray<BoardStage> {
  const board = itemBoard(item);
  if (board === 'work') return isPullRequestSource(item.source) ? PULL_REQUEST_STAGES : WORK_ITEM_STAGES;
  return boardStages(board);
}

/** Whether a card from `source` on `board` may enter `stage`: on Work, PR review is a pull request's own lane. */
export function pullRequestMayEnter(board: string, source: WorkItemSource, stage: string): boolean {
  if (board !== 'work') return true;
  if (!isPullRequestSource(source)) return stage !== 'pr-review';
  return PULL_REQUEST_STAGES.some(lane => lane.id === stage);
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
