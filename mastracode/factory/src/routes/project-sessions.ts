import type { IUserProvider } from '@mastra/core/server';

import type { BoardRegistry } from '../boards/registry.js';
import { SessionRowIndex } from '../session/session-rows.js';
import { isFactoryPrincipalId } from '../storage/domains/projects/base.js';
import { isSeenBy } from '../storage/domains/source-control/base.js';
import type { SourceControlSession, SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { Card, WorkItemsStorage, WorkItemSubscription } from '../storage/domains/work-items/base.js';

const MAX_SESSION_OWNER_PROFILES = 100;
const MAX_SESSION_OWNER_PROFILE_CACHE_ENTRIES = 500;
const SESSION_OWNER_PROFILE_TTL_MS = 5 * 60_000;

export interface SessionOwnerProfile {
  id: string;
  name: string;
  avatarUrl?: string;
}

export type SessionOwnerUserProvider = Pick<IUserProvider, 'getUser'> & Partial<Pick<IUserProvider, 'getUsers'>>;

export type SessionOwnerProfileResolver = (userIds: string[]) => Promise<Map<string, SessionOwnerProfile>>;

export type ListedSession = SourceControlSession & { owner?: SessionOwnerProfile; followedWorkItemIds: string[] };

export type ProjectSessionsReader = (scope: { orgId: string; factoryProjectId: string }) => Promise<ProjectSessions>;

export function createSessionOwnerProfileResolver(
  users: SessionOwnerUserProvider | undefined,
): SessionOwnerProfileResolver {
  const cache = new Map<string, { profile?: SessionOwnerProfile; expiresAt: number }>();
  const cacheProfile = (userId: string, profile: SessionOwnerProfile | undefined, expiresAt: number) => {
    cache.delete(userId);
    cache.set(userId, { profile, expiresAt });
    if (cache.size > MAX_SESSION_OWNER_PROFILE_CACHE_ENTRIES) {
      const oldestUserId = cache.keys().next().value;
      if (oldestUserId !== undefined) cache.delete(oldestUserId);
    }
  };

  return async userIds => {
    const profiles = new Map<string, SessionOwnerProfile>();
    // A session the Factory owns has no person to look up; it is named for what it is.
    for (const userId of userIds) {
      if (isFactoryPrincipalId(userId)) profiles.set(userId, { id: userId, name: 'Factory' });
    }
    if (!users) return profiles;
    const requestedUserIds = [...new Set(userIds)]
      .filter(userId => !isFactoryPrincipalId(userId))
      .slice(0, MAX_SESSION_OWNER_PROFILES);
    const unresolvedUserIds: string[] = [];
    const now = Date.now();

    for (const userId of requestedUserIds) {
      const cached = cache.get(userId);
      if (!cached || cached.expiresAt <= now) {
        cache.delete(userId);
        unresolvedUserIds.push(userId);
      } else if (cached.profile) {
        profiles.set(userId, cached.profile);
      }
    }
    if (unresolvedUserIds.length === 0) return profiles;

    let resolvedUsers: Array<Awaited<ReturnType<SessionOwnerUserProvider['getUser']>>>;
    if (users.getUsers) {
      try {
        resolvedUsers = await users.getUsers(unresolvedUserIds);
      } catch (error) {
        console.warn('[Factory Sessions] Bulk owner profile lookup failed; falling back to individual lookups', {
          error: error instanceof Error ? error.message : String(error),
        });
        resolvedUsers = (await Promise.allSettled(unresolvedUserIds.map(userId => users.getUser(userId))))
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value);
      }
    } else {
      resolvedUsers = (await Promise.allSettled(unresolvedUserIds.map(userId => users.getUser(userId))))
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);
    }

    for (const user of resolvedUsers) {
      if (!user) continue;
      const name = user.name?.trim() || user.email?.trim();
      if (!name) continue;
      profiles.set(user.id, {
        id: user.id,
        name,
        ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
      });
    }
    const expiresAt = now + SESSION_OWNER_PROFILE_TTL_MS;
    for (const userId of unresolvedUserIds) cacheProfile(userId, profiles.get(userId), expiresAt);
    return profiles;
  };
}

export function withOwnerProfile(session: SourceControlSession, owners: Map<string, SessionOwnerProfile>) {
  const owner = owners.get(session.userId);
  return owner ? { ...session, owner } : session;
}

export interface SeenSessions {
  /** In listing order. */
  readonly sessions: readonly ListedSession[];
  has(sessionId: string): boolean;
}

export class ProjectSessions {
  readonly #sessions: readonly ListedSession[];
  readonly #byId: ReadonlyMap<string, ListedSession>;
  #rows: { cards: readonly Card[]; boards: BoardRegistry; index: SessionRowIndex } | undefined;

  constructor(sessions: readonly ListedSession[]) {
    this.#sessions = sessions;
    this.#byId = new Map(sessions.map(session => [session.sessionId, session]));
  }

  seenBy(viewerUserId: string): SeenSessions {
    const byId = this.#byId;
    return {
      sessions: this.#sessions.filter(session => isSeenBy(session, viewerUserId)),
      has: sessionId => {
        const session = byId.get(sessionId);
        return session !== undefined && isSeenBy(session, viewerUserId);
      },
    };
  }

  rowIndex(cards: readonly Card[], boards: BoardRegistry): SessionRowIndex {
    if (this.#rows?.cards !== cards || this.#rows.boards !== boards) {
      this.#rows = { cards, boards, index: new SessionRowIndex(this.#sessions, cards, boards) };
    }
    return this.#rows.index;
  }
}

interface ProjectSessionsInputs {
  lists: readonly (readonly SourceControlSession[])[];
  follows: readonly WorkItemSubscription[] | undefined;
  owners: ReadonlyMap<string, SessionOwnerProfile>;
  sessions: ProjectSessions;
}

const NO_LIST: readonly SourceControlSession[] = Object.freeze([]);

function sameOwners(a: ReadonlyMap<string, SessionOwnerProfile>, b: ReadonlyMap<string, SessionOwnerProfile>) {
  if (a.size !== b.size) return false;
  for (const [userId, profile] of a) {
    const other = b.get(userId);
    if (other?.id !== profile.id || other.name !== profile.name || other.avatarUrl !== profile.avatarUrl) return false;
  }
  return true;
}

export function createProjectSessionsReader({
  sourceControls,
  users,
  workItems,
}: {
  sourceControls: readonly SourceControlStorageHandle[];
  users?: SessionOwnerUserProvider;
  workItems?: Pick<WorkItemsStorage, 'listProjectSubscriptions'>;
}): ProjectSessionsReader {
  const resolveOwnerProfiles = createSessionOwnerProfileResolver(users);
  const built = new WeakMap<readonly SourceControlSession[], ProjectSessionsInputs>();
  return async scope => {
    const [lists, follows] = await Promise.all([
      // Storage is partitioned per provider; a Factory's sessions can live in any of them.
      Promise.all(sourceControls.map(sourceControl => sourceControl.sessions.listSharedByProject(scope))),
      workItems?.listProjectSubscriptions(scope),
    ]);
    const owners = await resolveOwnerProfiles(lists.flatMap(list => list.map(session => session.userId)));
    const key = lists[0] ?? NO_LIST;
    const last = built.get(key);
    if (
      last !== undefined &&
      last.follows === follows &&
      last.lists.length === lists.length &&
      last.lists.every((list, index) => list === lists[index]) &&
      sameOwners(last.owners, owners)
    ) {
      return last.sessions;
    }
    // The follow link is the only tie between a person's session and a card's phase sessions.
    const followed = new Map<string, string[]>();
    for (const link of follows ?? []) {
      const workItemIds = followed.get(link.sessionId);
      if (workItemIds) workItemIds.push(link.workItemId);
      else followed.set(link.sessionId, [link.workItemId]);
    }
    const sessions = new ProjectSessions(
      lists.flat().map(session =>
        Object.freeze({
          ...withOwnerProfile(session, owners),
          followedWorkItemIds: followed.get(session.sessionId) ?? [],
        }),
      ),
    );
    built.set(key, { lists, follows, owners, sessions });
    return sessions;
  };
}
