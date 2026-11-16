import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';

import { SESSION_ACTIVITY_STATUSES, SESSION_STATUS_LABELS } from './sessionRows';
import type { SessionActivityStatus, SessionOwner } from './sessionRows';

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

export function sessionOwnerOptions(
  owners: readonly SessionOwner[],
  viewerUserId: string | undefined,
): DropdownMenuRadioOption<string>[] {
  const viewerOption = viewerUserId ? [{ value: MY_SESSIONS, label: 'Mine' }] : [];
  const namedOptions = owners.map(({ userId, name }) => ({
    value: sessionOwnerFilterValue(userId),
    label: name,
  }));
  return [{ value: ALL_SESSION_OWNERS, label: 'All owners' }, ...viewerOption, ...namedOptions];
}
