import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { AuthCapabilities } from '../types';
import { createAuthClient } from '../lib/auth-client';

/**
 * Fetches authentication capabilities from the server
 * This hook can be used both when authenticated and unauthenticated
 * - When unauthenticated: Returns public capabilities with login configuration
 * - When authenticated: Returns full capabilities including user info, roles, and permissions
 */
export function useAuthCapabilities() {
  const client = useMastraClient();

  const authClient = useMemo(() => {
    const baseUrl = (client as any).options?.baseUrl || '';
    return createAuthClient(baseUrl);
  }, [client]);

  return useQuery<AuthCapabilities>({
    queryKey: ['auth', 'capabilities'],
    queryFn: () => authClient.getCapabilities(),
    // Short TTL for auth state - we want to check auth state frequently
    // but not on every render
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute (formerly cacheTime)
    retry: false, // Don't retry auth checks - they should be fast
  });
}
