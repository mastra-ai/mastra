import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Hook to list all experiments across all datasets with optional pagination
 */
export const useExperiments = (pagination?: { page?: number; perPage?: number }) => {
  const client = useMastraClient();
  return useQuery({
    // Stryker disable next-line StringLiteral: a private cache identity — no other
    // module reads, seeds or invalidates this key, so renaming it is unobservable.
    queryKey: ['experiments', pagination],
    queryFn: () => client.listExperiments(pagination),
  });
};
