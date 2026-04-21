import type { PublicUserResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Resolves a batch of user IDs to display info (name / email / avatar).
 *
 * The underlying endpoint consults the configured `IUserProvider`
 * (e.g. WorkOS), so we can show human names regardless of the auth
 * provider — any provider that implements `getUser(id)` just works.
 *
 * Unknown IDs, unauthenticated callers, and deployments without a
 * provider come back as `{ id }` only, and we fall back to formatting
 * the raw id in the consuming components.
 */
export function useUserLookup(userIds: Array<string | undefined | null>) {
  const client = useMastraClient();

  // Stable, deduped, sorted list of non-empty ids for cache keying.
  const ids = useMemo(() => {
    const set = new Set<string>();
    for (const id of userIds) if (id) set.add(id);
    return Array.from(set).sort();
  }, [userIds]);

  const query = useQuery<Record<string, PublicUserResponse>>({
    queryKey: ['auth', 'users-lookup', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      try {
        const result = await client.lookupUsers(ids);
        const byId: Record<string, PublicUserResponse> = {};
        for (const user of result.users) {
          byId[user.id] = user;
        }
        return byId;
      } catch {
        // Unauthenticated / no provider — fall back to empty map and let
        // callers render the raw id.
        return {};
      }
    },
  });

  const usersById = query.data ?? {};

  const getDisplayName = (userId: string | undefined | null): string | undefined => {
    if (!userId) return undefined;
    const user = usersById[userId];
    if (!user) return undefined;
    return user.name || user.email || undefined;
  };

  return {
    usersById,
    getDisplayName,
    isLoading: query.isLoading,
  };
}
