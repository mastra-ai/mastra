import { SESSION_ROW_WINDOW } from '../routes/contracts.js';
import type {
  SessionActivityResponse,
  SessionRow,
  SessionRowsQuery,
  SessionRowsResponse,
} from '../routes/contracts.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { SLACK_SESSION_BRANCH_PREFIX } from '../work-item-branch.js';
import { sessionRowStatus } from './session-row-status.js';
import type { RowSession } from './session-rows.js';

export type SessionRowsView = Omit<SessionRowsQuery, 'pin' | 'children'>;

type SessionRowFields = Omit<SessionRow, 'childRows'>;

const UNMATERIALIZED_SETTLING_MS = 10 * 60_000;
const OWNER_PREFIX = 'owner:';
const HOUR_MS = 60 * 60 * 1_000;

const ACTIVITY_RANK: Record<SessionRow['status'], number> = {
  initializing: 0,
  working: 0,
  waiting: 0,
  idle: 1,
  done: 2,
};

const SESSION_ROW_ORDER: Record<SessionRowsView['sort'], (a: SessionRow, b: SessionRow) => number> = {
  activity: (a, b) =>
    ACTIVITY_RANK[a.status] - ACTIVITY_RANK[b.status] || b.session.createdAt.localeCompare(a.session.createdAt),
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  created: (a, b) => b.session.createdAt.localeCompare(a.session.createdAt),
};

const UPDATED_WINDOW_HOURS: Record<NonNullable<SessionRowsView['updated']>, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

const GROUP_KEY_OF_ROW: Record<SessionRowsView['groupBy'], (row: SessionRow) => string> = {
  board: row =>
    row.session.branch.startsWith(SLACK_SESSION_BRANCH_PREFIX)
      ? 'slack'
      : row.board === undefined
        ? 'user'
        : `board:${row.board}`,
  status: row => `status:${row.cardStatus ?? row.status}`,
  owner: row => `owner:${row.session.userId}`,
  none: () => 'all',
};

function compareSessionRows(sort: SessionRowsView['sort']) {
  const bySort = SESSION_ROW_ORDER[sort];
  return (a: SessionRow, b: SessionRow) =>
    Number(b.pinned) - Number(a.pinned) || bySort(a, b) || b.session.sessionId.localeCompare(a.session.sessionId);
}

function matchesOwner(row: SessionRowFields, owner: string, viewerUserId: string): boolean {
  if (owner === 'all') return true;
  if (owner === 'mine') return Boolean(viewerUserId) && row.session.userId === viewerUserId;
  if (!owner.startsWith(OWNER_PREFIX)) return false;
  return row.session.userId === owner.slice(OWNER_PREFIX.length);
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
): Omit<SessionRowsResponse, 'settling'> {
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

export function isSettling(
  sessions: readonly Pick<RowSession, 'materializedAt' | 'updatedAt'>[],
  now: number,
): boolean {
  return sessions.some(
    session => session.materializedAt === null && now - session.updatedAt.getTime() < UNMATERIALIZED_SETTLING_MS,
  );
}

function liveSessionCounts(
  cards: readonly Card[],
  running: ReadonlySet<string>,
  parked: ReadonlySet<string>,
): SessionActivityResponse['cards'] {
  const counts = { working: 0, waiting: 0 };
  for (const card of cards) {
    const sessionIds = Object.values(card.sessions).map(ref => ref.sessionId);
    const status = sessionRowStatus({
      running: sessionIds.some(id => running.has(id)),
      initializing: false,
      attention: sessionIds.some(id => parked.has(id)),
    });
    if (status === 'working') counts.working += 1;
    if (status === 'ready') counts.waiting += 1;
  }
  return counts;
}

export function sessionActivity(facts: {
  sessions: readonly RowSession[];
  cards: readonly Card[];
  runningSessionIds: ReadonlySet<string>;
  parkedSessionIds: ReadonlySet<string>;
  now: number;
}): SessionActivityResponse {
  const known = new Set([
    ...facts.sessions.map(session => session.sessionId),
    ...facts.cards.flatMap(card => Object.values(card.sessions).map(ref => ref.sessionId)),
  ]);
  const sorted = (ids: Iterable<string>) => [...ids].toSorted((a, b) => a.localeCompare(b));
  return {
    runningSessionIds: sorted([...facts.runningSessionIds].filter(id => known.has(id))),
    parkedSessionIds: sorted(facts.parkedSessionIds),
    initializingSessionIds: sorted(
      facts.sessions.flatMap(session => (session.materializedAt === null ? [session.sessionId] : [])),
    ),
    cards: liveSessionCounts(facts.cards, facts.runningSessionIds, facts.parkedSessionIds),
    settling: isSettling(facts.sessions, facts.now),
  };
}
