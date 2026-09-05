import type { FactoryUserSession } from './user-sessions';

export type UserSessionFilterStatus = 'all' | 'working' | 'initializing' | 'idle';
export type UserSessionUpdatedFilter = 'all' | '24h' | '7d' | '30d';

export const ALL_SESSION_OWNERS = 'all';
export const MY_SESSIONS = 'mine';
export const SESSION_OWNER_PREFIX = 'owner:';

export interface UserSessionFiltersState {
  search: string;
  owner: string;
  status: UserSessionFilterStatus;
  updated: UserSessionUpdatedFilter;
}

export interface UserSessionFilterCandidate {
  session: FactoryUserSession;
  ownerName: string;
  status: Exclude<UserSessionFilterStatus, 'all'>;
}

export const EMPTY_USER_SESSION_FILTERS: UserSessionFiltersState = {
  search: '',
  owner: ALL_SESSION_OWNERS,
  status: 'all',
  updated: 'all',
};

export function sessionOwnerFilterValue(userId: string): string {
  return `${SESSION_OWNER_PREFIX}${userId}`;
}

export function activeUserSessionFilterCount(filters: UserSessionFiltersState): number {
  return (
    Number(filters.search.trim() !== '') +
    Number(filters.owner !== ALL_SESSION_OWNERS) +
    Number(filters.status !== 'all') +
    Number(filters.updated !== 'all')
  );
}

function matchesSearch(candidate: UserSessionFilterCandidate, search: string): boolean {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  if (!normalizedSearch) return true;

  const { session, ownerName } = candidate;
  return [session.title, session.branch, ownerName, session.userId, session.sessionId].some(value =>
    value?.toLocaleLowerCase().includes(normalizedSearch),
  );
}

function matchesOwner(session: FactoryUserSession, owner: string, viewerUserId: string | undefined): boolean {
  if (owner === ALL_SESSION_OWNERS) return true;
  if (owner === MY_SESSIONS) return Boolean(viewerUserId) && session.userId === viewerUserId;
  if (!owner.startsWith(SESSION_OWNER_PREFIX)) return false;
  return session.userId === owner.slice(SESSION_OWNER_PREFIX.length);
}

function updatedCutoff(updated: UserSessionUpdatedFilter, now: number): number | undefined {
  if (updated === 'all') return undefined;
  const hours = updated === '24h' ? 24 : updated === '7d' ? 24 * 7 : 24 * 30;
  return now - hours * 60 * 60 * 1_000;
}

export function filterUserSessions(
  candidates: UserSessionFilterCandidate[],
  filters: UserSessionFiltersState,
  viewerUserId: string | undefined,
  now = Date.now(),
): UserSessionFilterCandidate[] {
  const cutoff = updatedCutoff(filters.updated, now);

  return candidates.filter(candidate => {
    if (!matchesSearch(candidate, filters.search)) return false;
    if (!matchesOwner(candidate.session, filters.owner, viewerUserId)) return false;
    if (filters.status !== 'all' && candidate.status !== filters.status) return false;
    if (cutoff !== undefined && new Date(candidate.session.updatedAt).getTime() < cutoff) return false;
    return true;
  });
}
