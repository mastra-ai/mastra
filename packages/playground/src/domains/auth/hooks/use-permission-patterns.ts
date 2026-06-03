import type { PermissionPattern } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Fetches the authoritative set of permission patterns from the server
 * (`GET /auth/permission-patterns`).
 *
 * The server owns the permission source of truth (generated from the route
 * registry), so the browser never imports the server-only `@mastra/core/auth/ee`
 * code just to validate hardcoded route-permission literals.
 */
export const usePermissionPatterns = (): { patterns: Set<PermissionPattern>; isLoading: boolean } => {
  const client = useMastraClient();

  const { data, isLoading } = useQuery({
    queryKey: ['permission-patterns'],
    queryFn: () => client.getPermissionPatterns(),
  });

  const patterns = useMemo(() => new Set<PermissionPattern>(data?.patterns ?? []), [data]);

  return { patterns, isLoading };
};
