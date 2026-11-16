import {
  SESSION_ROW_ALL_OWNERS,
  SESSION_ROW_MY_SESSIONS,
  SESSION_ROW_STATUSES,
  sessionRowOwnerKey,
} from '@mastra/factory/session/session-row-query';
import type { SESSION_ROW_UPDATED_WITHIN } from '@mastra/factory/session/session-row-query';
import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';

import { SESSION_STATUS_LABELS } from './sessionRows';
import type { SessionActivityStatus, SessionOwner } from './sessionRows';

export type SessionStatusFilter = 'all' | SessionActivityStatus;
export type SessionUpdatedFilter = 'all' | (typeof SESSION_ROW_UPDATED_WITHIN)[number];

export const SESSION_STATUS_OPTIONS: readonly DropdownMenuRadioOption<SessionStatusFilter>[] = [
  { value: 'all', label: 'All statuses' },
  ...SESSION_ROW_STATUSES.map(status => ({ value: status, label: SESSION_STATUS_LABELS[status] })),
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
  owner: SESSION_ROW_ALL_OWNERS,
  status: 'all',
  updated: 'all',
};

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
  const viewerOption = viewerUserId ? [{ value: SESSION_ROW_MY_SESSIONS, label: 'Mine' }] : [];
  const namedOptions = owners.map(({ userId, name }) => ({
    value: sessionRowOwnerKey(userId),
    label: name,
  }));
  return [{ value: SESSION_ROW_ALL_OWNERS, label: 'All owners' }, ...viewerOption, ...namedOptions];
}
