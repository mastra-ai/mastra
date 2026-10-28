import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';

import { SESSION_ACTIVITY_STATUSES, SESSION_STATUS_LABELS, sessionOwners } from './sessionRows';
import type { SessionActivityStatus, SessionListRow } from './sessionRows';

export type SessionStatusFilter = 'all' | SessionActivityStatus;
export type SessionUpdatedFilter = 'all' | '24h' | '7d' | '30d';

export const ALL_SESSION_OWNERS = 'all';
export const MY_SESSIONS = 'mine';
export const SESSION_OWNER_PREFIX = 'owner:';

export const SESSION_STATUS_OPTIONS: readonly DropdownMenuRadioOption<SessionStatusFilter>[] = [
  { value: 'all', label: 'All statuses' },
  ...SESSION_ACTIVITY_STATUSES.map(status => ({ value: status, label: SESSION_STATUS_LABELS[status] })),
];

export const SESSION_UPDATED_OPTIONS: readonly DropdownMenuRadioOption<SessionUpdatedFilter>[] = [
  { value: 'all', label: 'Any time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

export interface SessionFiltersState {
  owner: string;
  status: SessionStatusFilter;
  updated: SessionUpdatedFilter;
}

export const EMPTY_SESSION_FILTERS: SessionFiltersState = {
  owner: ALL_SESSION_OWNERS,
  status: 'all',
  updated: 'all',
};

export function sessionOwnerFilterValue(userId: string): string {
  return `${SESSION_OWNER_PREFIX}${userId}`;
}

export function activeSessionFilterCount(filters: SessionFiltersState): number {
  return (
    Number(filters.owner !== EMPTY_SESSION_FILTERS.owner) +
    Number(filters.status !== EMPTY_SESSION_FILTERS.status) +
    Number(filters.updated !== EMPTY_SESSION_FILTERS.updated)
  );
}

function matchesOwner(row: SessionListRow, owner: string, viewerUserId: string | undefined): boolean {
  if (owner === ALL_SESSION_OWNERS) return true;
  if (owner === MY_SESSIONS) return Boolean(viewerUserId) && row.session.userId === viewerUserId;
  if (!owner.startsWith(SESSION_OWNER_PREFIX)) return false;
  return row.session.userId === owner.slice(SESSION_OWNER_PREFIX.length);
}

const UPDATED_WINDOW_HOURS: Record<Exclude<SessionUpdatedFilter, 'all'>, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

function updatedCutoff(updated: SessionUpdatedFilter, now: number): number | undefined {
  if (updated === 'all') return undefined;
  return now - UPDATED_WINDOW_HOURS[updated] * 60 * 60 * 1_000;
}

export function filterSessionRows(
  rows: readonly SessionListRow[],
  filters: SessionFiltersState,
  viewerUserId: string | undefined,
  now = Date.now(),
): SessionListRow[] {
  const cutoff = updatedCutoff(filters.updated, now);

  return rows.filter(row => {
    if (!matchesOwner(row, filters.owner, viewerUserId)) return false;
    if (filters.status !== 'all' && row.status !== filters.status) return false;
    if (cutoff !== undefined && new Date(row.updatedAt).getTime() < cutoff) return false;
    return true;
  });
}

export function sessionOwnerOptions(
  rows: readonly SessionListRow[],
  viewerUserId: string | undefined,
): DropdownMenuRadioOption<string>[] {
  const viewerOption = viewerUserId ? [{ value: MY_SESSIONS, label: 'Mine' }] : [];
  const namedOptions = sessionOwners(rows).map(({ userId, name }) => ({
    value: sessionOwnerFilterValue(userId),
    label: name,
  }));
  return [{ value: ALL_SESSION_OWNERS, label: 'All owners' }, ...viewerOption, ...namedOptions];
}
