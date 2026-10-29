/**
 * Filtering, ordering and keyset paging for the work-items list, so a board can ask for the
 * cards it shows (one column, one filter, the first page of the user's sort) instead of every
 * card of the project.
 */

import { boardForWorkItem } from '../boards/semantics.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import { encodeWorkItemCursor } from './work-item-cursor.js';
import type { WorkItemPageCursor, WorkItemSort } from './work-item-cursor.js';

export interface WorkItemPageQuery {
  boards?: readonly string[];
  stages?: readonly string[];
  /** Case-insensitive match on the title or the external id. */
  q?: string;
  sort: WorkItemSort;
  /** Who "mine" means for `recent-mine`; without it that sort is plain `recent`. */
  userId?: string;
  limit?: number;
  cursor?: WorkItemPageCursor;
}

export interface WorkItemPage {
  items: readonly WorkItemRow[];
  nextCursor?: string;
}

/** When the card entered the column it sits in now; the board's "recent" position. */
function columnPosition(item: WorkItemRow): string {
  const stage = item.stages[0];
  let latest: string | undefined;
  for (const entry of item.stageHistory) {
    if (entry.stage !== stage || (latest !== undefined && entry.enteredAt <= latest)) continue;
    latest = entry.enteredAt;
  }
  return latest ?? item.createdAt.toISOString();
}

function sortKey(item: WorkItemRow, sort: WorkItemSort, userId: string | undefined): string {
  if (sort === 'created-newest' || sort === 'created-oldest') return item.createdAt.toISOString();
  if (sort === 'recent-mine' && userId) {
    const stage = item.stages[0];
    const entered = item.stageHistory.findLast(entry => entry.stage === stage);
    return `${entered?.by === userId ? 1 : 0}|${columnPosition(item)}`;
  }
  return columnPosition(item);
}

/** Orders like the board: the sort key (oldest-first only for `created-oldest`), then id descending. */
function compare(left: WorkItemPageCursor, right: WorkItemPageCursor, sort: WorkItemSort): number {
  const direction = sort === 'created-oldest' ? 1 : -1;
  if (left.key !== right.key) return (left.key < right.key ? -1 : 1) * direction;
  if (left.id === right.id) return 0;
  return left.id < right.id ? 1 : -1;
}

function matches(item: WorkItemRow, query: WorkItemPageQuery, needle: string | undefined): boolean {
  if (query.boards?.length && !query.boards.includes(boardForWorkItem(item))) return false;
  if (query.stages?.length && !query.stages.includes(item.stages[0] ?? '')) return false;
  if (!needle) return true;
  return (
    item.title.toLowerCase().includes(needle) ||
    (item.externalSource?.externalId.toLowerCase().includes(needle) ?? false)
  );
}

/**
 * One page of `items` under `query`. The cursor is the last card's sort key and id, so a card
 * that moves between requests can shift by one position but never repeats a whole page.
 */
export function pageWorkItems(items: readonly WorkItemRow[], query: WorkItemPageQuery): WorkItemPage {
  const needle = query.q?.trim().toLowerCase() || undefined;
  const keyed: { item: WorkItemRow; at: WorkItemPageCursor }[] = [];
  for (const item of items) {
    if (!matches(item, query, needle)) continue;
    const at = { key: sortKey(item, query.sort, query.userId), id: item.id };
    if (query.cursor && compare(at, query.cursor, query.sort) <= 0) continue;
    keyed.push({ item, at });
  }
  keyed.sort((left, right) => compare(left.at, right.at, query.sort));
  if (query.limit === undefined || keyed.length <= query.limit) return { items: keyed.map(({ item }) => item) };
  const page = keyed.slice(0, query.limit);
  return { items: page.map(({ item }) => item), nextCursor: encodeWorkItemCursor(page.at(-1)!.at) };
}

/** Cards per board and column, for stage chips and column headers that no longer load every card. */
export function countWorkItems(items: readonly WorkItemRow[]): {
  total: number;
  boards: Record<string, Record<string, number>>;
} {
  const boards: Record<string, Record<string, number>> = {};
  for (const item of items) {
    const stages = (boards[boardForWorkItem(item)] ??= {});
    const stage = item.stages[0] ?? '';
    stages[stage] = (stages[stage] ?? 0) + 1;
  }
  return { total: items.length, boards };
}

/** The metadata a board needs to recognise an issue or pull request it already has a card for. */
const SOURCE_METADATA_KEYS = ['githubIssueNumber', 'githubPullRequestNumber', 'number', 'githubRepositoryId'] as const;

/**
 * Every card's external source, without the rest of the card. Intake hides feed issues that
 * already have a card on any stage, so it needs these even for cards it never loads.
 */
export function workItemSources(items: readonly WorkItemRow[]) {
  return items.flatMap(item => {
    const source = item.externalSource;
    if (!source) return [];
    const metadata: Record<string, unknown> = {};
    for (const key of SOURCE_METADATA_KEYS) {
      if (item.metadata?.[key] !== undefined) metadata[key] = item.metadata[key];
    }
    return [
      {
        board: boardForWorkItem(item),
        externalSource: {
          integrationId: source.integrationId,
          type: source.type,
          externalId: source.externalId,
          ...(source.url ? { url: source.url } : {}),
        },
        metadata,
      },
    ];
  });
}
