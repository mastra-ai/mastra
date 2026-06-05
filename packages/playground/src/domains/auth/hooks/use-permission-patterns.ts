import type { PermissionPattern } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { isAuthenticated } from '../types';
import { useAuthCapabilities } from './use-auth-capabilities';

/**
 * Fetches the authoritative set of permission patterns from the server
 * (`GET /auth/permission-patterns`).
 *
 * The server owns the permission source of truth (generated from the route
 * registry), so the browser never imports the server-only `@mastra/core/auth/ee`
 * code just to validate hardcoded route-permission literals.
 *
 * The request only fires when RBAC is actually enabled — when auth is off or
 * RBAC isn't configured, route gating is a no-op so the pattern vocabulary is
 * not needed, and we avoid an unnecessary (and potentially 403/401) call.
 */
export const usePermissionPatterns = () => {
  const client = useMastraClient();
  const { data: capabilities, isLoading: capabilitiesLoading, error: capabilitiesError } = useAuthCapabilities();

  const rbacEnabled = !!(capabilities && isAuthenticated(capabilities) && capabilities.capabilities.rbac);

  const { data, isLoading, error } = useQuery({
    queryKey: ['permission-patterns'],
    queryFn: () => client.getPermissionPatterns(),
    // Only fetch the pattern vocabulary when RBAC gating is in effect.
    enabled: rbacEnabled,
    // The endpoint requires auth; on 403/401 we don't want React Query to
    // thrash with retries (which toggles isLoading and re-triggers redirect
    // guards). One attempt is enough — gating falls back to the user's
    // permissions if the pattern set is empty.
    retry: false,
    staleTime: Infinity,
  });

  const patterns = useMemo(() => new Set<PermissionPattern>(data?.patterns ?? []), [data]);

  // While capabilities are resolving we don't yet know whether RBAC applies, so
  // report loading. Once RBAC is ruled out, this hook is never "loading".
  return { patterns, isLoading: capabilitiesLoading || (rbacEnabled && isLoading), error: capabilitiesError || error };
};
