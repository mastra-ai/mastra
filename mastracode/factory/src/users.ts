import type { IUserProvider } from '@mastra/core/server';

/** Naming a user by id. Optional everywhere: providers that proxy the shared API cannot resolve arbitrary users. */
export type UserDirectory = Pick<IUserProvider, 'getUser' | 'getUsers'>;

export interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string;
}

/** Display profiles keyed by user id; unnamable ids are absent, and an outage degrades to ids. */
export async function resolveUserProfiles(
  directory: UserDirectory | undefined,
  userIds: string[],
): Promise<Map<string, UserProfile>> {
  const profiles = new Map<string, UserProfile>();
  if (!directory || userIds.length === 0) return profiles;

  const users = await lookup(directory, userIds);
  for (const [index, user] of users.entries()) {
    if (!user) continue;
    const id = userIds[index] ?? user.id;
    profiles.set(id, {
      id: user.id,
      name: user.name?.trim() || user.email?.trim() || user.id,
      ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    });
  }
  return profiles;
}

async function lookup(directory: UserDirectory, userIds: string[]) {
  try {
    return directory.getUsers
      ? await directory.getUsers(userIds)
      : await Promise.all(userIds.map(userId => directory.getUser(userId)));
  } catch (error) {
    console.warn('[factory] user directory lookup failed', error);
    return [];
  }
}
