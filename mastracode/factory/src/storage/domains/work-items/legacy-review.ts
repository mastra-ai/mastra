import type { WorkItemDbRow, WorkItemStageEntry } from './base.js';

/**
 * The retired built-in Review board. Its rows are never rewritten in bulk: reads
 * present them as Work cards, with the old `review` phase shown as Work's
 * `pr-review`, and the next ordinary write stores the Work placement.
 */
export const LEGACY_REVIEW_BOARD = 'review';

/**
 * Whether a stored placement belongs to the retired Review board: stored on it, or a
 * pull request's own card from before boards were persisted, which sat on Review.
 */
export function isLegacyReviewPlacement(board: string | null, primarySourceType: string | undefined): boolean {
  return board === LEGACY_REVIEW_BOARD || (board === null && primarySourceType === 'pull-request');
}

function workStage(stage: string): string {
  return stage === 'review' ? 'pr-review' : stage;
}

function workStages(stages: readonly string[]): string[] {
  return stages.map(workStage);
}

function workStageHistory(history: readonly WorkItemStageEntry[] | null | undefined): WorkItemStageEntry[] {
  return (history ?? []).map(entry => (entry.stage === 'review' ? { ...entry, stage: 'pr-review' } : entry));
}

/** A row as Work sees it: a stored Review placement reads as Work, `review` as `pr-review`. */
export function readLegacyReviewRow<
  Row extends Pick<WorkItemDbRow, 'board' | 'stages' | 'stage_history' | 'work_item_sources'>,
>(row: Row): Row {
  if (!isLegacyReviewPlacement(row.board, row.work_item_sources?.[0]?.source_type)) return row;
  return { ...row, board: 'work', stages: workStages(row.stages), stage_history: workStageHistory(row.stage_history) };
}

/**
 * Columns that store a legacy Review row's placement as Work, merged over the
 * columns a write already sets. Values a write passes are already in Work's
 * vocabulary (the caller read the aliased row); only stored ones are translated.
 */
export function normalizeLegacyReviewColumns(
  stored: { board: string | null; stages: string[]; stage_history: unknown },
  columns: { board?: string | null; stages?: string[]; stage_history?: unknown },
): { board: string | null; stages: string[]; stage_history: WorkItemStageEntry[] } {
  const board = columns.board === undefined || columns.board === LEGACY_REVIEW_BOARD ? 'work' : columns.board;
  return {
    board,
    stages: columns.stages ?? workStages(stored.stages),
    stage_history:
      (columns.stage_history as WorkItemStageEntry[] | undefined) ??
      workStageHistory(stored.stage_history as WorkItemStageEntry[] | null | undefined),
  };
}

/** Widen a board filter so stored legacy Review rows answer for Work. */
export function widenLegacyReviewBoardFilter(filter: unknown): unknown {
  if (filter === 'work') return { in: ['work', LEGACY_REVIEW_BOARD] };
  if (
    filter &&
    typeof filter === 'object' &&
    'in' in filter &&
    Array.isArray(filter.in) &&
    filter.in.includes('work')
  ) {
    return { ...filter, in: [...new Set([...filter.in, LEGACY_REVIEW_BOARD])] };
  }
  return filter;
}
