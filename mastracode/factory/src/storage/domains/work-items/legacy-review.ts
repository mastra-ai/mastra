import type { CollectionCursor, CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';

import type { WorkItemDbRow, WorkItemStageEntry } from './base.js';
import { FACTORY_BOARD_ITEMS_SCHEMA, WORK_ITEMS_SCHEMA } from './work-item-schema.js';

/**
 * The retired built-in Review board. New projects never get it. A project keeps it while it
 * still holds a card stored on it that isn't Done or Canceled ({@link readReviewBoardInUse});
 * there its cards stay on Review. In every other project it is redundant: reads present its
 * rows as Work cards, with the old `review` phase shown as Work's `pr-review`, and the next
 * ordinary write stores the Work placement. The rows are rewritten together only when the project
 * gets a board of its own under the key ({@link releaseLegacyReviewCards}).
 */
export const LEGACY_REVIEW_BOARD = 'review';

export interface ReviewBoardScope {
  orgId: string;
  factoryProjectId: string;
}

/** A board can't take the key `review` yet: the retired Review board still holds open cards. */
export class ReviewBoardInUseError extends Error {
  override name = 'ReviewBoardInUseError';
  constructor(readonly cards: number) {
    super(
      `The retired Review board still has ${cards} open ${cards === 1 ? 'card' : 'cards'}; move or finish ${
        cards === 1 ? 'it' : 'them'
      } before a board takes the key "review".`,
    );
  }
}

/** Answers whether a project still uses the Review board, reading through the caller's `ops`. */
export type ReviewBoardInUse = (ops: FactoryStorageOps, scope: ReviewBoardScope) => Promise<boolean>;

function openOnReview(row: { board: string | null; stages: readonly string[] | null }): boolean {
  return (
    row.board === LEGACY_REVIEW_BOARD && (row.stages ?? []).some(stage => stage !== 'done' && stage !== 'canceled')
  );
}

/**
 * Whether the project still uses the Review board: a card stored on it is in a phase other than
 * Done or Canceled. `tables` names where cards live: the split board items, the legacy table, or
 * both while legacy cards are still being copied.
 */
export async function readReviewBoardInUse(
  ops: FactoryStorageOps,
  scope: ReviewBoardScope,
  tables: { split: boolean; legacy: boolean } = { split: true, legacy: false },
): Promise<boolean> {
  const where: CollectionWhere = {
    org_id: scope.orgId,
    factory_project_id: scope.factoryProjectId,
    board: LEGACY_REVIEW_BOARD,
  };
  const collections = [
    ...(tables.split ? [FACTORY_BOARD_ITEMS_SCHEMA.name] : []),
    ...(tables.legacy ? [WORK_ITEMS_SCHEMA.name] : []),
  ];
  // Paged so a project with an open card answers from the first page instead of reading every Review row.
  const orderBy: [string, 'asc'][] = [['id', 'asc']];
  for (const collection of collections) {
    let cursor: CollectionCursor | undefined;
    for (;;) {
      const rows = await ops.findMany<{ id: string; board: string | null; stages: string[] | null }>(
        collection,
        where,
        { orderBy, limit: REVIEW_IN_USE_PAGE, ...(cursor ? { cursor } : {}) },
      );
      if (rows.some(openOnReview)) return true;
      if (rows.length < REVIEW_IN_USE_PAGE) break;
      cursor = { values: [rows[rows.length - 1]!.id] };
    }
  }
  return false;
}

const REVIEW_IN_USE_PAGE = 100;

type ReviewRow = { id: string; board: string | null; stages: string[] | null; stage_history: unknown };

/**
 * Stores the Work placement of every card stored on `review`, the way an ordinary write to such a
 * card does, so a board about to take the key starts with none of the retired Review board's
 * cards. `open` says what happens to cards that aren't Done or Canceled: `refuse` throws
 * {@link ReviewBoardInUseError} and writes nothing, `move` takes them to Work too. Returns how
 * many rows it rewrote.
 */
export async function releaseLegacyReviewCards(
  ops: FactoryStorageOps,
  scope: ReviewBoardScope,
  tables: { split: boolean; legacy: boolean },
  open: 'refuse' | 'move',
): Promise<number> {
  const where: CollectionWhere = {
    org_id: scope.orgId,
    factory_project_id: scope.factoryProjectId,
    board: LEGACY_REVIEW_BOARD,
  };
  const found: Array<{ collection: string; rows: ReviewRow[] }> = [];
  for (const collection of [
    ...(tables.split ? [FACTORY_BOARD_ITEMS_SCHEMA.name] : []),
    ...(tables.legacy ? [WORK_ITEMS_SCHEMA.name] : []),
  ]) {
    found.push({ collection, rows: await ops.findMany<ReviewRow>(collection, where) });
  }
  if (open === 'refuse') {
    // A card not copied to the split tables yet is in both; count it once.
    const stillOpen = new Set(found.flatMap(({ rows }) => rows.filter(openOnReview).map(row => row.id)));
    if (stillOpen.size > 0) throw new ReviewBoardInUseError(stillOpen.size);
  }
  let rewritten = 0;
  for (const { collection, rows } of found) {
    for (const { id } of rows) {
      // The card can have moved since it was read, so its placement comes from the row as it is now.
      const released = await ops.updateAtomic<ReviewRow>(collection, { id, board: LEGACY_REVIEW_BOARD }, current => {
        if (open === 'refuse' && openOnReview(current)) throw new ReviewBoardInUseError(1);
        return normalizeLegacyReviewColumns({ ...current, stages: current.stages ?? [] }, {});
      });
      if (released) rewritten += 1;
    }
  }
  return rewritten;
}

/**
 * Work's keys, for rows written when Work was the only board: they carry no board, or Work's,
 * and their phases are Work's by name. Only migrations and legacy writers read these.
 */
export const LEGACY_WORK_BOARD = 'work';
export const LEGACY_TRIAGE_PHASE = 'triage';
export const LEGACY_REST_PHASE = 'intake';

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

/**
 * A row as its project sees it. In a project that keeps Review (`reviewInUse`), a row stored on
 * it stays there; otherwise a Review placement reads as Work, `review` as `pr-review`.
 */
export function readLegacyReviewRow<
  Row extends Pick<WorkItemDbRow, 'board' | 'stages' | 'stage_history' | 'work_item_sources'>,
>(row: Row, reviewInUse = false): Row {
  if (!isLegacyReviewPlacement(row.board, row.work_item_sources?.[0]?.source_type)) return row;
  if (reviewInUse && row.board === LEGACY_REVIEW_BOARD) return row;
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
