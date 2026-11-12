import { boardIdOf, boardLoop, phaseKindOf } from './boardFlow';
import type { BoardInfo } from './boardFlow';
import { cardHasPullRequest, isPullRequestSource } from './services/workItems';
import type { WorkItem } from './services/workItems';
import { stageLabel } from './stages';
import type { BoardStage, BoardStageId } from './stages';

export type BoardKind = string;

export function belongsToBoard(item: WorkItem, kind: BoardKind): boolean {
  return itemBoard(item) === kind;
}

/** Whether `item` shows in the `stage` column; a card in no known column shows in the first one, where cards start. */
export function itemAppearsInStage(
  item: WorkItem,
  stage: BoardStageId,
  stages: ReadonlyArray<{ id: BoardStageId }>,
): boolean {
  if (item.stages.includes(stage)) return true;
  return stage === stages[0]?.id && !stages.some(candidate => item.stages.includes(candidate.id));
}

export function boardLoadingStages({
  stages,
  itemsPending,
  intakePending,
  triagePending,
  board,
}: {
  stages: ReadonlyArray<BoardStage>;
  itemsPending: boolean;
  intakePending: boolean;
  triagePending: boolean;
  /** The board on show; its rest and triage phases wait on the intake feed. */
  board?: BoardInfo;
}): ReadonlySet<BoardStageId> {
  const loading = new Set<BoardStageId>();
  if (itemsPending) {
    for (const stage of stages) loading.add(stage.id);
  }
  const loop = boardLoop(board);
  const rest = board?.initialPhase ?? stages[0]?.id;
  if (intakePending && rest !== undefined) loading.add(rest);
  if (triagePending && loop?.triage) loading.add(loop.triage.phase);
  return loading;
}

export function itemBoard(item: WorkItem): string {
  return boardIdOf(item);
}

/**
 * The columns a card can sit in on its board. On a board that reviews pull requests, a pull
 * request's own card stays out of the builder's phases, and only a card carrying one enters review.
 */
export function itemStageOptions(item: WorkItem, board: BoardInfo | undefined): ReadonlyArray<BoardStage> {
  if (!board) return [];
  return board.phases
    .filter(phase => pullRequestMayEnter(board, item, phase.id))
    .map(phase => ({ id: phase.id, label: phase.name ?? phase.title }));
}

/** Whether a card may enter `stage` on `board`, by the parts its phases play in the pull request loop. */
export function pullRequestMayEnter(
  board: BoardInfo | undefined,
  item: Pick<WorkItem, 'source' | 'workItem'>,
  stage: string,
): boolean {
  const loop = boardLoop(board);
  const review = loop?.pullRequestReview;
  if (!board || review === undefined) return true;
  if (isPullRequestSource(item.source)) return stage === review || phaseKindOf(board, stage) !== 'working';
  return stage !== review || cardHasPullRequest(item);
}

export function itemStageLabel(item: WorkItem, stage: string, board: BoardInfo | undefined): string {
  return itemStageOptions(item, board).find(candidate => candidate.id === stage)?.label ?? stageLabel(stage);
}

/** Furthest phase the item currently sits in; items with no known phase read as the board's first, like its columns. */
export function currentItemStage(item: WorkItem, board: BoardInfo | undefined): string | undefined {
  const options = itemStageOptions(item, board);
  const order = (stage: string) => options.findIndex(candidate => candidate.id === stage);
  // Phases the card can't sit in on its board would beat the real one, so they are dropped.
  const onBoard = item.stages.filter(stage => order(stage) !== -1);
  const furthest = onBoard.sort((a, b) => order(b) - order(a)).at(0);
  return furthest ?? board?.initialPhase ?? item.stages[0];
}

export function currentItemStageLabel(item: WorkItem, board: BoardInfo | undefined): string {
  const stage = currentItemStage(item, board);
  return stage === undefined ? '' : itemStageLabel(item, stage, board);
}
