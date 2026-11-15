import type { InstalledPhaseInfo } from '../../../api/types';
import { boardIdOf, boardLoop, phaseKindOf, phaseOf } from './boardFlow';
import type { BoardInfo } from './boardFlow';
import { cardHasPullRequest, isPullRequestSource } from './services/workItems';
import type { WorkItem } from './services/workItems';
import { stageLabel } from './stages';
import type { BoardStage, BoardStageId } from './stages';

export type BoardKind = string;

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
  board,
}: {
  stages: ReadonlyArray<BoardStage>;
  itemsPending: boolean;
  intakePending: boolean;
  /** The board on show; its initial phase waits on the intake setup. */
  board?: BoardInfo;
}): ReadonlySet<BoardStageId> {
  const loading = new Set<BoardStageId>();
  if (itemsPending) {
    for (const stage of stages) loading.add(stage.id);
  }
  const rest = board?.initialPhase ?? stages[0]?.id;
  if (intakePending && rest !== undefined) loading.add(rest);
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
    .map(phase => ({ id: phase.id, label: phaseName(phase) }));
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

/** Servers older than phase names send only the deprecated `title`. */
export function phaseName(phase: Pick<InstalledPhaseInfo, 'name' | 'title'>): string {
  return phase.name ?? phase.title;
}

export function phaseLabel(board: BoardInfo | undefined, stage: string): string {
  const phase = phaseOf(board, stage);
  return phase ? phaseName(phase) : stageLabel(stage);
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
  return stage === undefined ? '' : phaseLabel(board, stage);
}
