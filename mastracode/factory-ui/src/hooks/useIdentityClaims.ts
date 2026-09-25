import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { claimIdentity, listIdentity, unclaimIdentity } from '../ui/domains/settings/services/identityClaims';
import type { IdentityIndex, IdentityRow } from '../ui/domains/settings/services/identityClaims';

/**
 * The consolidated identity index: every integration that exposes the identity
 * capability plus every identity across those integrations, each annotated
 * with whether the acting user has claimed it. Backs both the settings
 * multi-select and the `useResolvedMe` hook consumed by `@me` filters.
 */
export function useIdentityQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery<IdentityIndex>({
    queryKey: queryKeys.identity(baseUrl),
    queryFn: () => listIdentity(baseUrl),
  });
}

/**
 * Shared mutation key for claim/unclaim so each mutation can see whether a
 * sibling is still in flight before it refetches the shared index. Scoped by
 * `baseUrl` — a mutation against endpoint A must not defer to a pending
 * mutation against endpoint B, or A's index never reconciles.
 */
const identityMutationKey = (baseUrl: string) => ['identity-claims', baseUrl] as const;

/** Toggle `claimed` on the row matching (integrationId, externalUserId); no-op if absent. */
function setClaimed(index: IdentityIndex | undefined, key: ClaimKey, claimed: boolean): IdentityIndex | undefined {
  if (!index) return index;
  let mutated = false;
  const identities = index.identities.map(row => {
    if (row.integrationId !== key.integrationId || row.externalUserId !== key.externalUserId) return row;
    if (row.claimed === claimed) return row;
    mutated = true;
    return { ...row, claimed };
  });
  return mutated ? { ...index, identities } : index;
}

/**
 * Optimistically insert a new claim row when a POST names an identity that
 * isn't in the current index (e.g. a manual/future entry). Keeps the UI
 * responsive without waiting for the refetch to hydrate the row.
 */
function insertClaim(index: IdentityIndex | undefined, input: ClaimInput): IdentityIndex | undefined {
  if (!index) return index;
  const exists = index.identities.some(
    row => row.integrationId === input.integrationId && row.externalUserId === input.externalUserId,
  );
  if (exists) return setClaimed(index, input, true);
  const row: IdentityRow = {
    integrationId: input.integrationId,
    externalUserId: input.externalUserId,
    label: input.label,
    email: input.email,
    claimed: true,
  };
  return { ...index, identities: [...index.identities, row] };
}

type ClaimKey = { integrationId: string; externalUserId: string };
type ClaimInput = ClaimKey & { label: string; email?: string };

/**
 * Claim an identity. Applies an optimistic update to the identity cache so
 * the multi-select tick and `@me` filters flip immediately, rolls back on
 * error, and refetches on settle to reconcile with the server.
 */
export function useClaimIdentityMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const identityKey = queryKeys.identity(baseUrl);
  const mutationKey = identityMutationKey(baseUrl);
  return useMutation({
    mutationKey,
    mutationFn: (input: ClaimInput) => claimIdentity(baseUrl, input),
    onMutate: async input => {
      await queryClient.cancelQueries({ queryKey: identityKey });
      const previous = queryClient.getQueryData<IdentityIndex>(identityKey);
      const existingRow = previous?.identities.find(
        row => row.integrationId === input.integrationId && row.externalUserId === input.externalUserId,
      );
      queryClient.setQueryData<IdentityIndex>(identityKey, current => insertClaim(current, input));
      return { existed: Boolean(existingRow), wasClaimed: existingRow?.claimed ?? false };
    },
    onError: (_error, input, context) => {
      // Roll back only this identity — restoring a whole-index snapshot
      // would erase a sibling mutation's optimistic state.
      queryClient.setQueryData<IdentityIndex>(identityKey, current => {
        if (!current) return current;
        if (!context?.existed) {
          return {
            ...current,
            identities: current.identities.filter(
              row => row.integrationId !== input.integrationId || row.externalUserId !== input.externalUserId,
            ),
          };
        }
        return setClaimed(current, input, context.wasClaimed);
      });
    },
    onSettled: () => {
      // Refetching while a sibling identity mutation is still pending would
      // clobber its optimistic row; reconcile once the last one settles.
      if (queryClient.isMutating({ mutationKey }) === 1) {
        void queryClient.invalidateQueries({ queryKey: identityKey });
      }
    },
  });
}

/**
 * Unclaim an identity. Optimistically flips the row's `claimed` flag so the
 * UI updates without waiting for the DELETE + refetch, rolls back on error,
 * and refetches on settle to reconcile with the server.
 */
export function useUnclaimIdentityMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const identityKey = queryKeys.identity(baseUrl);
  const mutationKey = identityMutationKey(baseUrl);
  return useMutation({
    mutationKey,
    mutationFn: (key: ClaimKey) => unclaimIdentity(baseUrl, key),
    onMutate: async key => {
      await queryClient.cancelQueries({ queryKey: identityKey });
      const previous = queryClient.getQueryData<IdentityIndex>(identityKey);
      const existingRow = previous?.identities.find(
        row => row.integrationId === key.integrationId && row.externalUserId === key.externalUserId,
      );
      queryClient.setQueryData<IdentityIndex>(identityKey, current => setClaimed(current, key, false));
      return { wasClaimed: existingRow?.claimed ?? false };
    },
    onError: (_error, key, context) => {
      // Identity-specific rollback; see useClaimIdentityMutation.
      queryClient.setQueryData<IdentityIndex>(identityKey, current =>
        setClaimed(current, key, context?.wasClaimed ?? true),
      );
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey }) === 1) {
        void queryClient.invalidateQueries({ queryKey: identityKey });
      }
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
