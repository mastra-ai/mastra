/**
 * Filtering, ordering and keyset paging for the work-items list, so a board can ask for the
 * cards it shows (one column, one filter, the first page of the user's sort) instead of every
 * card of the project.
 */

import { boardForWorkItem } from '../boards/semantics.js';
import { isHumanActorId } from '../storage/domains/audit/actors.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import { encodeWorkItemCursor } from './work-item-cursor.js';
import type { WorkItemPageCursor, WorkItemSort } from './work-item-cursor.js';

/** The board's person filters; each holds participant ids like `github:octocat` or `factory:<userId>`. */
export const WORK_ITEM_PERSON_FILTERS = ['teammate', 'author', 'assignee', 'reviewer', 'worked'] as const;
type PersonFilter = (typeof WORK_ITEM_PERSON_FILTERS)[number];
type PersonRole = 'authored' | 'assigned' | 'review-requested' | 'worked';

const PERSON_FILTER_ROLES: Record<PersonFilter, readonly PersonRole[]> = {
  teammate: ['authored', 'assigned', 'review-requested', 'worked'],
  author: ['authored'],
  assignee: ['assigned'],
  reviewer: ['review-requested'],
  worked: ['worked'],
};

/** The board's filters, matched the way the board matches its loaded cards. */
export interface WorkItemFilters {
  boards?: readonly string[];
  stages?: readonly string[];
  /** Case-insensitive match on the title or the external id. */
  q?: string;
  /** `github`, `gitlab`, `linear`, `jira`, `incidentio`, `slack` or `manual`. */
  sources?: readonly string[];
  linearProjects?: readonly string[];
  /** Case-insensitive; any picked label matches. */
  labels?: readonly string[];
  /** Every non-empty person filter must match; within one, any picked person in any of its roles will do. */
  people?: Partial<Record<PersonFilter, readonly string[]>>;
}

export interface WorkItemPageQuery extends WorkItemFilters {
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

function metadataStrings(item: WorkItemRow, key: string): string[] {
  const value = item.metadata?.[key];
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => (typeof entry === 'string' && entry.trim() ? [entry.trim()] : []));
}

function itemSource(item: WorkItemRow): string {
  return item.externalSource?.integrationId ?? 'manual';
}

/** What the card itself says about who it involves — the same roles the board's person filters read. */
function personRoles(item: WorkItemRow): Record<PersonRole, Set<string>> {
  const source = itemSource(item);
  const external = (names: string[]) => new Set(names.map(name => `${source}:${name.toLowerCase()}`));
  const pullRequest = item.externalSource?.type === 'pull-request';
  const issueTracker = source === 'linear' || source === 'jira' || source === 'incidentio';
  const author = issueTracker
    ? [
        ...metadataStrings(item, 'creator'),
        ...metadataStrings(item, 'linearCreator'),
        ...metadataStrings(item, 'author'),
      ].slice(0, 1)
    : metadataStrings(item, 'author');
  const assignees = issueTracker
    ? [...metadataStrings(item, 'assignee'), ...metadataStrings(item, 'linearAssignee')].slice(0, 1)
    : [...metadataStrings(item, 'assignees'), ...metadataStrings(item, 'assignee')];
  const roles: Record<PersonRole, Set<string>> = {
    authored: source === 'manual' || source === 'slack' ? new Set() : external(author),
    assigned: source === 'manual' || source === 'slack' ? new Set() : external(assignees),
    'review-requested': pullRequest ? external(metadataStrings(item, 'requestedReviewers')) : new Set(),
    worked: new Set(),
  };
  const humans = [
    item.createdBy,
    ...item.stageHistory.flatMap(entry => [entry.by, entry.exitedBy]),
    ...Object.values(item.sessions).map(session => session.startedBy),
  ];
  for (const actor of humans) if (isHumanActorId(actor)) roles.worked.add(`factory:${actor}`);
  if (!item.externalSource && isHumanActorId(item.createdBy)) roles.authored.add(`factory:${item.createdBy}`);
  return roles;
}

function matchesPeople(item: WorkItemRow, people: WorkItemFilters['people']): boolean {
  const picked = WORK_ITEM_PERSON_FILTERS.filter(filter => people?.[filter]?.length);
  if (picked.length === 0) return true;
  const roles = personRoles(item);
  return picked.every(filter => {
    const ids = new Set(people![filter]!.map(id => id.toLowerCase()));
    return PERSON_FILTER_ROLES[filter].some(role => [...roles[role]].some(id => ids.has(id.toLowerCase())));
  });
}

export function matchesWorkItemFilters(item: WorkItemRow, filters: WorkItemFilters): boolean {
  if (filters.boards?.length && !filters.boards.includes(boardForWorkItem(item))) return false;
  if (filters.stages?.length && !filters.stages.includes(item.stages[0] ?? '')) return false;
  const sources = filters.sources?.length ? filters.sources : filters.linearProjects?.length ? ['linear'] : undefined;
  if (sources && !sources.includes(itemSource(item))) return false;
  if (filters.linearProjects?.length && itemSource(item) === 'linear') {
    const project = item.metadata?.linearProjectId;
    if (typeof project !== 'string' || !filters.linearProjects.includes(project)) return false;
  }
  if (filters.labels?.length) {
    const labels = new Set(metadataStrings(item, 'labels').map(label => label.toLowerCase()));
    if (!filters.labels.some(label => labels.has(label.toLowerCase()))) return false;
  }
  if (!matchesPeople(item, filters.people)) return false;
  const needle = filters.q?.trim().toLowerCase();
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
  const keyed: { item: WorkItemRow; at: WorkItemPageCursor }[] = [];
  for (const item of items) {
    if (!matchesWorkItemFilters(item, query)) continue;
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
/** Cards per board and column. Filters other than the stage apply, so a filtered board still counts every column. */
export function countWorkItems(
  items: readonly WorkItemRow[],
  filters: WorkItemFilters = {},
): {
  total: number;
  boards: Record<string, Record<string, number>>;
} {
  const across = { ...filters, stages: undefined };
  const boards: Record<string, Record<string, number>> = {};
  let total = 0;
  for (const item of items) {
    if (!matchesWorkItemFilters(item, across)) continue;
    total += 1;
    const stages = (boards[boardForWorkItem(item)] ??= {});
    const stage = item.stages[0] ?? '';
    stages[stage] = (stages[stage] ?? 0) + 1;
  }
  return { total, boards };
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

/** Card metadata the board never reads; the biggest per-card payload on review boards. */
const UNSYNCED_METADATA_KEYS = ['selfReviewFindings'] as const;

/** The card as a board sync carries it: everything the board filters, sorts and renders. */
export function toSyncedWorkItem(item: WorkItemRow): WorkItemRow {
  const metadata = item.metadata;
  if (!metadata || !UNSYNCED_METADATA_KEYS.some(key => key in metadata)) return item;
  const kept = { ...metadata };
  for (const key of UNSYNCED_METADATA_KEYS) delete kept[key];
  return { ...item, metadata: kept };
}

/**
 * How far behind `now` a sync cursor sits. Card writes stamp `changed_at` from each server's
 * clock before their transaction commits, so a cursor at `now` could step past a write that
 * becomes visible after it. Re-sending the last 30s of writes covers clock skew and slow
 * commits; a board replaces re-sent cards by id, and also reloads periodically as a backstop.
 */
export const WORK_ITEM_SYNC_OVERLAP_MS = 30_000;

export interface WorkItemSync {
  /** True when `items` replaces the board's cards rather than patching them. */
  reset: boolean;
  /** On reset, every card outside a terminal phase; otherwise every card written since the cursor. */
  items: readonly WorkItemRow[];
  deletedIds: string[];
  /** The next cursor. */
  at: Date;
}

/**
 * A board's view of the project since `since`: without it (or when it is older than deletes
 * are kept for), the open cards to start from; with it, just the cards that changed.
 */
export function syncWorkItems(
  all: readonly WorkItemRow[],
  {
    since,
    now,
    deleted,
    isTerminal,
    oldestDelta,
  }: {
    since?: Date;
    now: Date;
    deleted: readonly { id: string; deletedAt: Date }[];
    isTerminal: (item: WorkItemRow) => boolean;
    oldestDelta: Date;
  },
): WorkItemSync {
  const behind = new Date(now.getTime() - WORK_ITEM_SYNC_OVERLAP_MS);
  if (!since || since < oldestDelta) {
    return { reset: true, items: all.filter(item => !isTerminal(item)), deletedIds: [], at: behind };
  }
  return {
    reset: false,
    items: all.filter(item => item.changedAt >= since),
    deletedIds: deleted.filter(entry => entry.deletedAt >= since).map(entry => entry.id),
    at: behind > since ? behind : since,
  };
}
