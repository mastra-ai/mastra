import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { claimIdentity, listIdentity, unclaimIdentity } from '../ui/domains/settings/services/identityClaims';
import type { IdentityIndex } from '../ui/domains/settings/services/identityClaims';

/**
 * The consolidated identity index: every integration that exposes the identity
 * capability plus every identity across those integrations, each annotated
 * with whether the acting user has claimed it. Backs both the settings
 * multi-select and the `useResolvedMe` hook consumed by `@me` filters.
 */
export function useIdentityQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery<IdentityIndex>({
    queryKey: queryKeys.identity(),
    queryFn: () => listIdentity(baseUrl),
  });
}

/** Claim an identity; refreshes the identity cache on success. */
export function useClaimIdentityMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { integrationId: string; externalUserId: string; label: string; email?: string }) =>
      claimIdentity(baseUrl, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.identity() });
    },
  });
}

/** Unclaim an identity; refreshes the identity cache on success. */
export function useUnclaimIdentityMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: { integrationId: string; externalUserId: string }) => unclaimIdentity(baseUrl, key),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.identity() });
    },
  });
}

/**
 * Resolved `@me` set derived from the identity index — a
 * `Map<integrationId, Set<externalUserId>>` matching `ResolvedMe` on the
 * server. Board filters and Cmd+K search consume it to expand `@me` into a
 * match against any of the user's claimed external identities. Memoized so
 * that filter chips and search predicates can safely refer to the map
 * identity in dep arrays.
 */
export function useResolvedMe(): {
  data: Map<string, Set<string>>;
  isLoading: boolean;
  isError: boolean;
} {
  const query = useIdentityQuery();
  const data = useMemo(() => {
    const resolved = new Map<string, Set<string>>();
    for (const row of query.data?.identities ?? []) {
      if (!row.claimed) continue;
      let set = resolved.get(row.integrationId);
      if (!set) {
        set = new Set();
        resolved.set(row.integrationId, set);
      }
      set.add(row.externalUserId);
    }
    return resolved;
  }, [query.data]);
  return { data, isLoading: query.isLoading, isError: query.isError };
}
