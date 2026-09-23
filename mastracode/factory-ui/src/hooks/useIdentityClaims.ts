import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  listAllIdentityCandidates,
  listIdentityCandidates,
  listIdentityIntegrations,
  listMyIdentityClaims,
  removeIdentityClaim,
  upsertIdentityClaim,
} from '../ui/domains/settings/services/identityClaims';
import type {
  IdentityCandidate,
  IdentityCandidateAcrossIntegrations,
  IdentityClaim,
  IdentityIntegrationDescriptor,
} from '../ui/domains/settings/services/identityClaims';

/** Every integration that surfaces the identity capability. Populates the settings selector. */
export function useIdentityIntegrationsQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery<IdentityIntegrationDescriptor[]>({
    queryKey: queryKeys.identityIntegrations(),
    queryFn: () => listIdentityIntegrations(baseUrl),
  });
}

/** The acting user's claimed accounts, across every integration. */
export function useIdentityClaimsQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery<IdentityClaim[]>({
    queryKey: queryKeys.identityClaims(),
    queryFn: () => listMyIdentityClaims(baseUrl),
  });
}

/**
 * Candidate accounts for one integration; disabled when no integration is
 * selected. React Query keys the cache on the `query` filter, so switching
 * filter values doesn't clobber the previous view during load.
 */
export function useIdentityCandidatesQuery(integrationId: string | undefined, query?: string) {
  const { baseUrl } = useApiConfig();
  return useQuery<IdentityCandidate[]>({
    queryKey: queryKeys.identityCandidates(integrationId, query),
    queryFn: () => listIdentityCandidates(baseUrl, integrationId!, query),
    enabled: Boolean(integrationId),
  });
}

/** Candidate accounts across every identity-capable integration, merged into one feed. */
export function useAllIdentityCandidatesQuery(query?: string) {
  const { baseUrl } = useApiConfig();
  return useQuery<IdentityCandidateAcrossIntegrations[]>({
    queryKey: queryKeys.identityAllCandidates(query),
    queryFn: () => listAllIdentityCandidates(baseUrl, query),
  });
}

/** Persist a claim; refreshes the list and the resolved-me cache on success. */
export function useUpsertIdentityClaimMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { integrationId: string; externalUserId: string; label: string; email?: string }) =>
      upsertIdentityClaim(baseUrl, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.identityClaims() });
    },
  });
}

/** Remove a claim; refreshes the list and the resolved-me cache on success. */
export function useRemoveIdentityClaimMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: { integrationId: string; externalUserId: string }) => removeIdentityClaim(baseUrl, key),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.identityClaims() });
    },
  });
}

/**
 * Resolved `@me` set derived from the claim list — a `Map<integrationId,
 * Set<externalUserId>>` matching `ResolvedMe` on the server. Board filters
 * and Cmd+K search consume it to expand `@me` into a match against any of
 * the user's claimed external identities. Memoized so that filter chips and
 * search predicates can safely refer to the map identity in dep arrays.
 */
export function useResolvedMe(): {
  data: Map<string, Set<string>>;
  isLoading: boolean;
  isError: boolean;
} {
  const claimsQuery = useIdentityClaimsQuery();
  const data = useMemo(() => {
    const resolved = new Map<string, Set<string>>();
    for (const claim of claimsQuery.data ?? []) {
      let set = resolved.get(claim.integrationId);
      if (!set) {
        set = new Set();
        resolved.set(claim.integrationId, set);
      }
      set.add(claim.externalUserId);
    }
    return resolved;
  }, [claimsQuery.data]);
  return { data, isLoading: claimsQuery.isLoading, isError: claimsQuery.isError };
}
