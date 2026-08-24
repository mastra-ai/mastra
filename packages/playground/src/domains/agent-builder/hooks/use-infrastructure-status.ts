import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

interface UseInfrastructureStatusOptions {
  enabled?: boolean;
}

/**
 * Fetches Agent Builder infrastructure configuration and resolution status from
 * the server. Admin-only by default — the server requires `infrastructure:read`.
 */
export const useInfrastructureStatus = (options?: UseInfrastructureStatusOptions) => {
  const client = useMastraClient();

  return useQuery({
    // Stryker disable next-line ArrayDeclaration,StringLiteral: this key is a private
    // cache identity — no other module reads, seeds or invalidates it, so a rename is
    // unobservable. Pinning the literal in a test would only mirror the implementation.
    queryKey: ['infrastructure-status'],
    queryFn: () => client.getInfrastructureStatus(),
    // Stryker disable next-line LogicalOperator: `??` and `&&` are equivalent here.
    // They differ only when `options.enabled` is undefined, and react-query treats
    // `enabled: undefined` exactly like `enabled: true`.
    enabled: options?.enabled ?? true,
    retry: false,
  });
};
