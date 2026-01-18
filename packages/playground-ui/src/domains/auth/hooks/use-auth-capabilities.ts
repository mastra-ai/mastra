import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { AuthCapabilities } from '../types';

/**
 * Fetches authentication capabilities from the server
 * This hook can be used both when authenticated and unauthenticated
 * - When unauthenticated: Returns public capabilities with login configuration
 * - When authenticated: Returns full capabilities including user info, roles, and permissions
 */
export function useAuthCapabilities() {
  const client = useMastraClient();

  return useQuery<AuthCapabilities>({
    queryKey: ['auth', 'capabilities'],
    queryFn: async () => {
      const baseUrl = (client as any).options?.baseUrl || '';
      const response = await fetch(`${baseUrl}/api/auth/capabilities`, {
        credentials: 'include', // Include cookies for session validation
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch auth capabilities: ${response.statusText}`);
      }

      return response.json();
    },
    // Short TTL for auth state - we want to check auth state frequently
    // but not on every render
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute (formerly cacheTime)
    retry: false, // Don't retry auth checks - they should be fast
  });
}
