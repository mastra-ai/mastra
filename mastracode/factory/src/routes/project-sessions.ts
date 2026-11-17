import type { IUserProvider } from '@mastra/core/server';

import { isFactoryPrincipalId } from '../storage/domains/projects/base.js';
import type { SourceControlSession, SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

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

export type ProjectSessionsReader = (scope: {
  orgId: string;
  factoryProjectId: string;
  userId: string;
}) => Promise<ListedSession[]>;

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
  return async ({ orgId, factoryProjectId, userId }) => {
    // Storage is partitioned per provider; a Factory's sessions can live in any of them.
    const sessions = (
      await Promise.all(
        sourceControls.map(sourceControl =>
          sourceControl.sessions.listByProject({ orgId, factoryProjectId, viewerUserId: userId }),
        ),
      )
    ).flat();
    const owners = await resolveOwnerProfiles(sessions.map(session => session.userId));
    // The follow link is the only tie between a person's session and a card's phase sessions.
    const followed = new Map<string, string[]>();
    for (const link of (await workItems?.listProjectSubscriptions({ orgId, factoryProjectId })) ?? []) {
      const workItemIds = followed.get(link.sessionId);
      if (workItemIds) workItemIds.push(link.workItemId);
      else followed.set(link.sessionId, [link.workItemId]);
    }
    return sessions.map(session => ({
      ...withOwnerProfile(session, owners),
      followedWorkItemIds: followed.get(session.sessionId) ?? [],
    }));
  };
}
