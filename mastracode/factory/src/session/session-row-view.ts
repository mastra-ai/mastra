import type {
  SessionActivityResponse,
  SessionRow,
  SessionRowsQuery,
  SessionRowsResponse,
} from '../routes/contracts.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { SLACK_SESSION_BRANCH_PREFIX } from '../work-item-branch.js';
import {
  SESSION_ROW_ALL_OWNERS,
  SESSION_ROW_MY_SESSIONS,
  SESSION_ROW_WINDOW,
  sessionRowGroupKeys,
  sessionRowOwnerKey,
} from './session-row-query.js';
import { isInFlight } from './session-rows.js';
import type { CardSessionStatus, RowSession } from './session-rows.js';

export type SessionRowsView = Omit<SessionRowsQuery, 'pin' | 'children'>;

type SessionRowFields = Omit<SessionRow, 'childRows'>;

const HOUR_MS = 60 * 60 * 1_000;

const ACTIVITY_RANK: Record<SessionRow['status'], number> = {
  initializing: 0,
  working: 0,
  waiting: 0,
  idle: 1,
  done: 2,
};

const newestFirst = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

const SESSION_ROW_ORDER: Record<SessionRowsView['sort'], (a: SessionRow, b: SessionRow) => number> = {
  activity: (a, b) =>
    ACTIVITY_RANK[a.cardStatus ?? a.status] - ACTIVITY_RANK[b.cardStatus ?? b.status] ||
    newestFirst(a.updatedAt, b.updatedAt),
  updated: (a, b) => newestFirst(a.updatedAt, b.updatedAt),
  created: (a, b) => newestFirst(a.session.createdAt, b.session.createdAt),
};

const UPDATED_WINDOW_HOURS: Record<NonNullable<SessionRowsView['updated']>, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

/** Where a row's sessions start: the board grouping's group, and what the `source` filter compares. */
function sourceOf(row: SessionRowFields): string {
  if (row.session.branch.startsWith(SLACK_SESSION_BRANCH_PREFIX)) return sessionRowGroupKeys.slack;
  return row.board === undefined ? sessionRowGroupKeys.user : sessionRowGroupKeys.board(row.board);
}

const GROUP_KEY_OF_ROW: Record<SessionRowsView['groupBy'], (row: SessionRow) => string> = {
  board: sourceOf,
  status: row => sessionRowGroupKeys.status(row.cardStatus ?? row.status),
  owner: row => sessionRowGroupKeys.owner(row.session.userId),
  none: () => sessionRowGroupKeys.all,
};

function compareSessionRows(sort: SessionRowsView['sort']) {
  const bySort = SESSION_ROW_ORDER[sort];
  return (a: SessionRow, b: SessionRow) =>
    Number(b.pinned) - Number(a.pinned) || bySort(a, b) || b.session.sessionId.localeCompare(a.session.sessionId);
}

function matchesOwner(row: SessionRowFields, owner: string, viewerUserId: string): boolean {
  if (owner === SESSION_ROW_ALL_OWNERS) return true;
  if (owner === SESSION_ROW_MY_SESSIONS) return Boolean(viewerUserId) && row.session.userId === viewerUserId;
  return owner === sessionRowOwnerKey(row.session.userId);
}

// A card with revealed sessions matches when any of its sessions does, and lists only the ones that match.
function filterSessionRows(
  rows: readonly SessionRow[],
  view: SessionRowsView,
  viewerUserId: string,
  now: number,
): SessionRow[] {
  const cutoff = view.updated === undefined ? undefined : now - UPDATED_WINDOW_HOURS[view.updated] * HOUR_MS;
  const matches = (row: SessionRowFields) =>
    matchesOwner(row, view.owner, viewerUserId) &&
    (view.source === undefined || sourceOf(row) === view.source) &&
    (view.status === undefined || row.status === view.status) &&
    (cutoff === undefined || Date.parse(row.updatedAt) >= cutoff);
  return rows.flatMap(row => {
    if (!row.childRows) return matches(row) ? [row] : [];
    const childRows = row.childRows.filter(matches);
    return matches(row) || childRows.length > 0 ? [{ ...row, childRows }] : [];
  });
}

function windowedGroup(key: string, rows: readonly SessionRow[], view: SessionRowsView) {
  const { open } = view;
  const openIndex =
    open === undefined
      ? -1
      : rows.findIndex(
          row =>
            row.session.sessionId === open ||
            row.cardSessionIds?.includes(open) === true ||
            row.childRows?.some(child => child.session.sessionId === open) === true,
        );
  const count = view.window.get(key) ?? SESSION_ROW_WINDOW;
  const visible = rows.slice(0, count + Number(openIndex >= count));
  const openRow = rows[openIndex];
  if (openRow && openIndex >= visible.length) visible[visible.length - 1] = openRow;
  return { key, total: rows.length, ...(openIndex === -1 ? {} : { openIndex }), rows: visible };
}

export function sessionRowsView(
  rows: readonly SessionRow[],
  view: SessionRowsView,
  viewerUserId: string,
  now: number,
): SessionRowsResponse {
  const matching = filterSessionRows(rows.toSorted(compareSessionRows(view.sort)), view, viewerUserId, now);
  const groupKeyOf = GROUP_KEY_OF_ROW[view.groupBy];
  const rowsByGroup = new Map<string, SessionRow[]>();
  for (const row of matching) {
    const key = groupKeyOf(row);
    const groupRows = rowsByGroup.get(key);
    if (groupRows) groupRows.push(row);
    else rowsByGroup.set(key, [row]);
  }
  const owners = new Map<string, SessionRowsResponse['owners'][number]>();
  for (const { session } of rows) {
    if (owners.has(session.userId) && !session.owner) continue;
    owners.set(session.userId, {
      userId: session.userId,
      ...(session.owner ? { name: session.owner.name } : {}),
      ...(session.owner?.avatarUrl !== undefined ? { avatarUrl: session.owner.avatarUrl } : {}),
    });
  }
  return {
    total: rows.length,
    matching: matching.length,
    groups: Array.from(rowsByGroup, ([key, groupRows]) => windowedGroup(key, groupRows, view)),
    boards: [...new Set(rows.flatMap(row => (row.board === undefined ? [] : [row.board])))].toSorted((a, b) =>
      a.localeCompare(b),
    ),
    owners: [...owners.values()].toSorted((a, b) => a.userId.localeCompare(b.userId)),
  };
}

function liveSessionCounts(statuses: Iterable<SessionRow['status']>): SessionActivityResponse['cards'] {
  const counts = { working: 0, waiting: 0 };
  for (const status of statuses) {
    if (status === 'working') counts.working += 1;
    if (status === 'waiting') counts.waiting += 1;
  }
  return counts;
}

export function sessionActivity(facts: {
  sessions: readonly RowSession[];
  cards: readonly Card[];
  runningSessionIds: ReadonlySet<string>;
  parkedSessionIds: ReadonlySet<string>;
  cardStatuses: ReadonlyMap<string, CardSessionStatus>;
}): SessionActivityResponse {
  const known = new Set([
    ...facts.sessions.map(session => session.sessionId),
    ...facts.cards.flatMap(card => Object.values(card.sessions).map(ref => ref.sessionId)),
  ]);
  const sorted = (ids: Iterable<string>) => [...ids].toSorted((a, b) => a.localeCompare(b));
  const cards = [...facts.cardStatuses];
  const inFlight = cards.filter(([, { status }]) => isInFlight(status));
  return {
    runningSessionIds: sorted([...facts.runningSessionIds].filter(id => known.has(id))),
    parkedSessionIds: sorted(facts.parkedSessionIds),
    cardStatuses: Object.fromEntries(
      inFlight.toSorted(([a], [b]) => a.localeCompare(b)).map(([id, { status }]) => [id, status]),
    ),
    sessionHeldCardIds: sorted(cards.flatMap(([id, { held }]) => (held ? [id] : []))),
    cards: liveSessionCounts(inFlight.map(([, { status }]) => status)),
  };
}
